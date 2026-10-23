import express, { Router } from "express";
import { ExtractCvPdfQueryParams, type CvExtractionResult } from "@workspace/api-zod";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../lib/pdf-extraction.ts";
import { simulateCvMapping } from "../lib/cv-demo-mapping.ts";
import { CvError } from "../lib/cv-errors.ts";

type Dependencies = {
  extract: typeof extractPdfText;
};

// There is no live mapper dependency: public requests cannot select a provider.
export function createCvExtractionRouter(deps: Dependencies = {
  extract: extractPdfText,
}) {
  const router = Router();
  let active = 0;
  let windowStart = 0;
  let requests = 0;
  router.post("/profile/extract-pdf", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // This is a feature prohibition, NOT authentication. Reject before PDF work.
    if (req.query.map_profile === "true") {
      res.status(403).json({ code: "LIVE_MAPPING_BLOCKED" }); return;
    }
    const query = ExtractCvPdfQueryParams.safeParse(req.query);
    if (!query.success || req.get("X-CV-Consent") !== "local-extraction") {
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
      const result: CvExtractionResult = { ...extracted, profile: null, mapping: "NOT_REQUESTED", mapping_provenance: "none" };
      if (extracted.status === "OCR_REQUIRED") result.mapping = "OCR_REQUIRED";
      else if (req.query.mapping_mode === "demo") {
        result.profile = simulateCvMapping(extracted.text, req.query.profile_type as "fresh_graduate" | "career_switcher");
        result.mapping = "SIMULATED";
        result.mapping_provenance = "simulated";
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
