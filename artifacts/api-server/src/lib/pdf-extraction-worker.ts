import { parentPort, workerData } from "node:worker_threads";
import { PDFParse } from "pdf-parse";

// Data only: never load a document URL, execute embedded JS, render images,
// log document content, or inherit the API process's secrets.
const parser = new PDFParse({
  data: new Uint8Array(workerData),
  isEvalSupported: false,
  stopAtErrors: true,
  verbosity: 0,
  useSystemFonts: false,
});
try {
  const info = await parser.getInfo();
  if (info.permission !== null && info.permission !== undefined) {
    parentPort?.postMessage({ error: "ENCRYPTED_PDF" });
  } else if (info.total < 1 || info.total > 30) {
    parentPort?.postMessage({ error: "PAGE_LIMIT" });
  } else {
    const pages: string[] = [];
    let length = 0;
    for (let n = 1; n <= info.total; n++) {
      const result = await parser.getText({ partial: [n], pageJoiner: "" });
      // Use actual page text, not page-number markers (which make blank PDFs nonempty).
      // PDF.js's partial-page path can insert NUL separators between ToUnicode-
      // mapped glyphs. They are control artifacts, not document text; remove
      // them so CJK and mixed-script words remain intact for classification/map.
      const text = result.pages.map(page => page.text).join("\n").replace(/\0/gu, "");
      length += text.length;
      if (length > 60_000) throw new Error("TEXT_TOO_LARGE");
      pages.push(text);
    }
    const text = pages.join("\n").trim();
    parentPort?.postMessage({ status: text ? "TEXT_EXTRACTED" : "OCR_REQUIRED", text, pages: info.total });
  }
} catch (error) {
  const name = error instanceof Error ? error.name : "";
  const code = name === "PasswordException" ? "ENCRYPTED_PDF"
    : error instanceof Error && error.message === "TEXT_TOO_LARGE" ? "TEXT_TOO_LARGE" : "CORRUPT_PDF";
  parentPort?.postMessage({ error: code });
} finally {
  await parser.destroy().catch(() => {});
}
