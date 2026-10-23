import express, { Router } from "express";
import { ExtractCvPdfQueryParams, type CvExtractionResult } from "@workspace/api-zod";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../lib/pdf-extraction.ts";
import { createGlmProfileClient, serverGlmSettings } from "../lib/runpod-glm-profile.ts";
import { CvError } from "../lib/cv-errors.ts";

type Dependencies = {
  extract: typeof extractPdfText;
  map: ReturnType<typeof createGlmProfileClient>["extract"];
};

// Factory allows actual HTTP tests with an entirely mocked mapper.
export function createCvExtractionRouter(deps: Dependencies = {
  extract: extractPdfText,
  map: createGlmProfileClient({ settings: serverGlmSettings }).extract,
}) {
  const router = Router();
  let active = 0;
  let windowStart = 0;
  let requests = 0;
  let liveWindowStart = 0;
  let liveRequests = 0;
  router.post("/profile/extract-pdf", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const query = ExtractCvPdfQueryParams.safeParse(req.query);
    const mapping = req.query.map_profile === "true";
    if (!query.success || req.get("X-CV-Consent") !== (mapping ? "runpod-text" : "local-extraction")) {
      res.status(400).json({ code: "CONSENT_REQUIRED" }); return;
    }
    if (req.get("Sec-Fetch-Site") === "cross-site") {
      res.status(403).json({ code: "CONSENT_REQUIRED" }); return;
    }
    if (!req.is("application/pdf")) { res.status(415).json({ code: "PDF_ONLY" }); return; }
    const now = Date.now();
    if (now - windowStart > 60_000) { windowStart = now; requests = 0; }
    if (active >= 2 || requests >= 10) { res.status(429).json({ code: "BUSY" }); return; }
    requests++;
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    res.once("finish", release);
    res.locals.releaseCvSlot = release;
    res.once("close", () => { if (!res.locals.processingCv) release(); });
    next();
  }, express.raw({ type: "application/pdf", limit: MAX_CV_PDF_BYTES }), async (req, res) => {
    res.locals.processingCv = true;
    try {
      if (!Buffer.isBuffer(req.body)) throw new CvError("EMPTY_FILE", 400);
      const extracted = await deps.extract(req.body, req.get("Content-Type"));
      const result: CvExtractionResult = { ...extracted, profile: null, mapping: "NOT_REQUESTED" };
      if (extracted.status === "OCR_REQUIRED") result.mapping = "OCR_REQUIRED";
      else if (req.query.map_profile === "true") {
        const now = Date.now();
        if (now - liveWindowStart > 3_600_000) { liveWindowStart = now; liveRequests = 0; }
        if (liveRequests >= 5) result.mapping = "RATE_LIMITED";
        else {
          try {
            // This per-process budget is a backstop, not authentication or a billing cap.
            liveRequests++;
            result.profile = await deps.map(extracted.text, req.query.profile_type as "fresh_graduate" | "career_switcher");
            result.mapping = "READY";
          } catch (error) {
            const safe = ["LIVE_DISABLED", "KEY_MISSING", "AUTH_ERROR", "RATE_LIMITED", "UPSTREAM_TIMEOUT",
              "UPSTREAM_ERROR", "MALFORMED_RESPONSE", "INVALID_PROFILE", "TEXT_TOO_LARGE"] as const;
            result.mapping = error instanceof CvError && safe.includes(error.code as typeof safe[number])
              ? error.code as typeof safe[number] : "UPSTREAM_ERROR";
          }
        }
      }
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (!res.destroyed) res.status(error instanceof CvError ? error.status : 422)
        .json({ code: error instanceof CvError ? error.code : "CORRUPT_PDF" });
    } finally {
      res.locals.releaseCvSlot?.();
    }
  });
  // Body-parser failures must never reflect uploaded content or raw stack traces.
  router.use((error: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === "entity.too.large" ? 413 : 400)
      .json({ code: error.type === "entity.too.large" ? "FILE_TOO_LARGE" : "INVALID_UPLOAD" });
  });
  return router;
}
