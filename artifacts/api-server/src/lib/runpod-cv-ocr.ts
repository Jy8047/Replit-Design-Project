import type runpodSdk from "runpod-sdk";
import type { EndpointOutput } from "runpod-sdk";

// Type-only SDK imports: this module never constructs a real Runpod client.
type QueueEndpoint = Pick<
  NonNullable<ReturnType<ReturnType<typeof runpodSdk>["endpoint"]>>,
  "run" | "status"
>;

export const OFFLINE_OCR_FIXTURES = [
  "text_pdf",
  "scanned_pdf",
  "empty_output",
  "worker_failure",
  "malformed_output",
  "oversized_output",
  "timed_out",
  "cancelled",
] as const;
export type OfflineOcrFixture = typeof OFFLINE_OCR_FIXTURES[number];
export const MAX_OFFLINE_OCR_JOBS = 32;
export const MAX_OCR_TEXT_CHARACTERS = 200_000;

type JobStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
type ErrorCode =
  | "LIVE_DISABLED" | "INVALID_FIXTURE" | "OFFLINE_JOB_LIMIT" | "OFFLINE_JOB_NOT_FOUND"
  | "NO_TEXT" | "WORKER_FAILED" | "INVALID_OUTPUT" | "OUTPUT_TOO_LARGE"
  | "TIMED_OUT" | "CANCELLED" | "INVALID_STATUS";

export class OfflineCvOcrError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "OfflineCvOcrError";
    this.code = code;
  }
}

export type OfflineOcrJob = {
  id: string;
  status: JobStatus;
  mode: "offline";
  provenance: "synthetic_fixture";
  confirmed_by_user: false;
  text: string | null;
  error: { code: ErrorCode; message: string } | null;
};

export const CV_OCR_AVAILABILITY = Object.freeze({
  mode: "offline" as const,
  liveCallsEnabled: false,
  realPdfExtractionAvailable: false,
  message: "Offline fixtures only. No PDF is parsed, uploaded, or sent to Runpod.",
});

function isFixture(value: unknown): value is OfflineOcrFixture {
  return typeof value === "string"
    && OFFLINE_OCR_FIXTURES.some(fixture => fixture === value);
}

function fixtureCompletion(fixture: OfflineOcrFixture, id: string): EndpointOutput {
  const base = { id, executionTime: 0, delayTime: 0 };
  if (fixture === "worker_failure") return { ...base, status: "FAILED" };
  if (fixture === "timed_out") return { ...base, status: "TIMED_OUT" };
  if (fixture === "cancelled") return { ...base, status: "CANCELLED" };
  // This is a MOCK worker output contract, not a verified Runpod OCR worker schema.
  const output = fixture === "malformed_output" ? { text: 42 }
    : {
      provenance: "synthetic_fixture",
      text: fixture === "empty_output" ? " \n "
        : fixture === "oversized_output" ? "x".repeat(MAX_OCR_TEXT_CHARACTERS + 1)
          : fixture === "scanned_pdf"
            ? "[SYNTHETIC OCR FIXTURE — no image recognition performed]\nFictional College\nSkills: Communication, Writing"
            : "[SYNTHETIC TEXT FIXTURE — no PDF parsing performed]\nFictional Student\nFictional University\nSkills: Research, Writing",
    };
  return { ...base, status: "COMPLETED", output };
}

let nextAdapterId = 0;

/** No credentials, environment reads, URLs, real file inputs, or network clients. */
export function createOfflineCvOcrAdapter() {
  const adapterId = ++nextAdapterId;
  const jobs = new Map<string, { fixture: OfflineOcrFixture; polls: number }>();
  let sequence = 0;

  // Implements only the SDK's run/status signatures against an in-memory queue.
  // Not injectable: callers cannot accidentally supply a live endpoint.
  const endpoint: QueueEndpoint = {
    async run(request) {
      const input: unknown = request.input;
      const fixture = input && typeof input === "object" && "fixture_id" in input
        ? input.fixture_id : undefined;
      if (!isFixture(fixture)) {
        throw new OfflineCvOcrError("INVALID_FIXTURE", "Choose a bundled synthetic fixture.");
      }
      if (jobs.size >= MAX_OFFLINE_OCR_JOBS) {
        throw new OfflineCvOcrError("OFFLINE_JOB_LIMIT", "This offline adapter has reached its test-job limit.");
      }
      const id = `offline-cv-ocr-${adapterId}-${++sequence}`;
      jobs.set(id, { fixture, polls: 0 });
      return { id, status: "IN_QUEUE" };
    },
    async status(id) {
      const job = jobs.get(id);
      if (!job) throw new OfflineCvOcrError("OFFLINE_JOB_NOT_FOUND", "Offline job not found in this adapter.");
      job.polls += 1;
      if (job.polls === 1) return { id, status: "IN_PROGRESS" };
      return fixtureCompletion(job.fixture, id);
    },
  };

  function failure(id: string, status: JobStatus, code: ErrorCode, message: string): OfflineOcrJob {
    return {
      id, status, mode: "offline", provenance: "synthetic_fixture",
      confirmed_by_user: false, text: null, error: { code, message },
    };
  }

  function normalizeJob(result: EndpointOutput): OfflineOcrJob {
    const base: OfflineOcrJob = {
      id: result.id, status: "IN_QUEUE", mode: "offline",
      provenance: "synthetic_fixture", confirmed_by_user: false, text: null, error: null,
    };
    if (result.status === "IN_QUEUE" || result.status === "IN_PROGRESS") {
      return { ...base, status: result.status };
    }
    if (result.status === "FAILED") {
      return failure(result.id, "FAILED", "WORKER_FAILED", "The synthetic worker-failure fixture failed.");
    }
    if (result.status === "TIMED_OUT" || result.status === "CANCELLED") {
      return failure(result.id, result.status, result.status, "The synthetic job did not complete.");
    }
    if (result.status !== "COMPLETED") {
      return failure(result.id, "FAILED", "INVALID_STATUS", "Unexpected worker status.");
    }
    const output: unknown = "output" in result ? result.output : undefined;
    if (!output || typeof output !== "object" || Array.isArray(output)
      || !("text" in output) || typeof output.text !== "string"
      || !("provenance" in output) || output.provenance !== "synthetic_fixture") {
      return failure(result.id, "FAILED", "INVALID_OUTPUT", "The synthetic worker output is invalid.");
    }
    if (!output.text.trim()) {
      return failure(result.id, "FAILED", "NO_TEXT", "The synthetic fixture has no usable text.");
    }
    if (output.text.length > MAX_OCR_TEXT_CHARACTERS) {
      return failure(result.id, "FAILED", "OUTPUT_TOO_LARGE", "The synthetic worker output exceeds the text limit.");
    }
    return { ...base, status: "COMPLETED", text: output.text };
  }

  return Object.freeze({
    availability: CV_OCR_AVAILABILITY,
    async submitFixture(fixture: OfflineOcrFixture): Promise<OfflineOcrJob> {
      // fixture_id is mock-only. A real worker's input contract is not known yet.
      return normalizeJob(await endpoint.run({ input: { fixture_id: fixture } }));
    },
    async getJob(id: string): Promise<OfflineOcrJob> {
      if (typeof id !== "string" || !/^offline-cv-ocr-\d+-\d+$/.test(id)) {
        throw new OfflineCvOcrError("OFFLINE_JOB_NOT_FOUND", "Only this adapter's offline job IDs are accepted.");
      }
      return normalizeJob(await endpoint.status(id));
    },
    async extractPdf(_document: unknown): Promise<never> {
      // Reject without examining, retaining, serializing, or logging the argument.
      throw new OfflineCvOcrError("LIVE_DISABLED", "Real CV extraction is disabled. Only bundled synthetic fixtures are available.");
    },
  });
}
