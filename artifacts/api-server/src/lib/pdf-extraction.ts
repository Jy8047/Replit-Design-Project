import { Worker } from "node:worker_threads";
import { CvError } from "./cv-errors.ts";

export const MAX_CV_PDF_BYTES = 10 * 1024 * 1024;
export type PdfTextResult = { status: "TEXT_EXTRACTED" | "OCR_REQUIRED"; text: string; pages: number };

export async function extractPdfText(bytes: Uint8Array, contentType = "application/pdf"): Promise<PdfTextResult> {
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/pdf") throw new CvError("PDF_ONLY", 415);
  if (!bytes.length) throw new CvError("EMPTY_FILE", 400);
  if (bytes.length > MAX_CV_PDF_BYTES) throw new CvError("FILE_TOO_LARGE", 413);
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
    || !Buffer.from(bytes.subarray(-1024)).includes(Buffer.from("%%EOF"))) throw new CvError("CORRUPT_PDF");
  return new Promise((resolve, reject) => {
    const extension = import.meta.url.endsWith(".ts") ? ".ts" : ".mjs";
    const worker = new Worker(new URL(`./pdf-extraction-worker${extension}`, import.meta.url), {
      workerData: bytes,
      env: {},
      resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
      stdout: true,
      stderr: true,
    });
    // Do not pipe PDF.js warnings, raw errors, or document data into server logs.
    worker.stdout?.resume();
    worker.stderr?.resume();
    let settled = false;
    const finish = (error?: CvError, result?: PdfTextResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => finish(new CvError("PDF_TIMEOUT", 422)), 15_000);
    worker.once("message", (message) => {
      if (message.error) finish(new CvError(message.error));
      else if ((message.status === "TEXT_EXTRACTED" || message.status === "OCR_REQUIRED")
        && typeof message.text === "string" && Number.isInteger(message.pages)) finish(undefined, message);
      else finish(new CvError("CORRUPT_PDF"));
    });
    worker.once("error", () => finish(new CvError("CORRUPT_PDF")));
    worker.once("exit", () => { if (!settled) finish(new CvError("CORRUPT_PDF")); });
  });
}
