import { Router, type Request, type Response } from "express";
import { ExtractCvPdfQueryParams, type CvExtractionResult } from "@workspace/api-zod";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../lib/pdf-extraction.ts";
import { simulateCvMapping } from "../lib/cv-demo-mapping.ts";
import { CvError } from "../lib/cv-errors.ts";
import { classifyPdfLanguage } from "../lib/pdf-language.ts";

export const CV_REQUEST_DEADLINE_MS = 30_000;
type Dependencies = { extract: typeof extractPdfText; map?: typeof simulateCvMapping };

// Count actual wire-body bytes, including chunked requests. No decompression,
// draining an endless rejected body, or buffering beyond the existing limit.
function readPdfBody(req: Request, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const fail = (error: CvError) => {
      if (settled) return;
      settled = true;
      cleanup();
      req.pause();
      chunks.length = 0;
      reject(error);
    };
    const onError = () => fail(new CvError("INVALID_UPLOAD", 400));
    const onAbort = () => fail(signal.reason instanceof CvError ? signal.reason : new CvError("UPLOAD_ABORTED", 400));
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_CV_PDF_BYTES) fail(new CvError("FILE_TOO_LARGE", 413));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, size));
      chunks.length = 0;
    };
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    req.once("aborted", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

// Close rejected uploads instead of keeping/draining an attacker-controlled body.
function rejectUpload(req: Request, res: Response, error: CvError) {
  req.pause();
  if (res.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  res.shouldKeepAlive = false;
  res.setHeader("Connection", "close");
  const socket = req.socket;
  const forceClose = setTimeout(() => socket.destroy(), 1_000);
  forceClose.unref();
  socket.once("close", () => clearTimeout(forceClose));
  res.once("finish", () => req.destroy());
  res.status(error.status).json({ code: error.code });
}

// Deadline overrides are server/test-only and can only shorten the 30s ceiling.
// There is no live mapper dependency: public requests cannot select a provider.
export function createCvExtractionRouter(
  deps: Dependencies = { extract: extractPdfText },
  options: { deadlineMs?: number } = {},
) {
  const configured = options.deadlineMs ?? CV_REQUEST_DEADLINE_MS;
  if (!Number.isFinite(configured) || configured <= 0) throw new Error("Invalid CV deadline");
  const deadlineMs = Math.min(configured, CV_REQUEST_DEADLINE_MS);
  const router = Router();
  let active = 0;
  let windowStart = 0;
  let requests = 0;
  router.post("/profile/extract-pdf", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const controller = new AbortController();
    let held = false;
    let processing = false;
    const release = () => { if (held) { held = false; active--; } };
    const cleanup = () => {
      clearTimeout(deadline);
      req.off("aborted", disconnected);
      res.off("close", disconnected);
      res.off("finish", completed);
    };
    const disconnected = () => {
      if (!res.writableFinished) controller.abort(new CvError("UPLOAD_ABORTED", 400));
      cleanup();
      if (!processing) release();
    };
    const completed = () => {
      cleanup();
      if (!processing) release();
    };
    const deadline = setTimeout(() => {
      const error = new CvError("UPLOAD_TIMEOUT", 408);
      controller.abort(error);
      rejectUpload(req, res, error);
    }, deadlineMs);
    req.once("aborted", disconnected);
    res.once("close", disconnected);
    res.once("finish", completed);
    try {
      // Feature prohibition, NOT authentication. Reject before body/worker work.
      if (req.query.map_profile === "true") throw new CvError("LIVE_MAPPING_BLOCKED", 403);
      const query = ExtractCvPdfQueryParams.safeParse(req.query);
      if (!query.success || req.get("X-CV-Consent") !== "local-extraction") throw new CvError("CONSENT_REQUIRED", 400);
      if (req.get("Sec-Fetch-Site") === "cross-site") throw new CvError("CONSENT_REQUIRED", 403);
      const encoding = req.get("Content-Encoding");
      if (encoding !== undefined && encoding.trim().toLowerCase() !== "identity") throw new CvError("UNSUPPORTED_ENCODING", 415);
      if (!req.is("application/pdf")) throw new CvError("PDF_ONLY", 415);
      const length = req.get("Content-Length");
      if (length !== undefined) {
        if (!/^\d+$/.test(length)) throw new CvError("INVALID_UPLOAD", 400);
        if (BigInt(length) > BigInt(MAX_CV_PDF_BYTES)) throw new CvError("FILE_TOO_LARGE", 413);
      }
      const now = Date.now();
      if (now - windowStart > 60_000) { windowStart = now; requests = 0; }
      if (active >= 2 || requests >= 10) throw new CvError("BUSY", 429);
      requests++;
      active++;
      held = true;
      const bytes = await readPdfBody(req, controller.signal);
      controller.signal.throwIfAborted();
      processing = true;
      const extracted = await deps.extract(bytes, req.get("Content-Type"), controller.signal);
      controller.signal.throwIfAborted();
      if (extracted.status === "TEXT_EXTRACTED") {
        const language = classifyPdfLanguage(extracted.text);
        if (language === "UNSUPPORTED") throw new CvError("UNSUPPORTED_LANGUAGE");
        if (language === "INSUFFICIENT") throw new CvError("INSUFFICIENT_TEXT");
      }
      const result: CvExtractionResult = { ...extracted, profile: null, mapping: "NOT_REQUESTED", mapping_provenance: "none" };
      if (extracted.status === "OCR_REQUIRED") result.mapping = "OCR_REQUIRED";
      else if (req.query.mapping_mode === "demo") {
        result.profile = (deps.map ?? simulateCvMapping)(extracted.text, req.query.profile_type as "fresh_graduate" | "career_switcher");
        result.mapping = "SIMULATED";
        result.mapping_provenance = "simulated";
      }
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (!res.writableEnded && !res.destroyed) rejectUpload(req, res,
        error instanceof CvError ? error : new CvError("CORRUPT_PDF"));
    } finally {
      processing = false;
      release();
      if (res.destroyed || res.writableFinished) cleanup();
    }
  });
  return router;
}
