import { createOfflineCvOcrAdapter } from "../src/lib/runpod-cv-ocr.ts";

const adapter = createOfflineCvOcrAdapter();
const queued = await adapter.submitFixture("text_pdf");
const processing = await adapter.getJob(queued.id);
const completed = await adapter.getJob(queued.id);

process.stdout.write(JSON.stringify({
  notice: "OFFLINE DEMO ONLY. Bundled synthetic text, not OCR or PDF extraction.",
  availability: adapter.availability,
  transitions: [queued.status, processing.status, completed.status],
  result: completed,
}, null, 2) + "\n");
