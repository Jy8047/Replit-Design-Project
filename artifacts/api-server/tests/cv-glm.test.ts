import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { createGlmProfileClient, validateExtractedProfile, serverGlmSettings, RUNPOD_GLM_BASE_URL } from "../src/lib/runpod-glm-profile.ts";
import { fictionalProfile, fictionalText } from "./cv-fixtures.ts";

mock.method(globalThis, "fetch", () => { throw new Error("Live requests prohibited in tests"); });
after(() => mock.restoreAll());
const response = (content: unknown = fictionalProfile(), finish_reason = "stop") => new Response(JSON.stringify({
  choices: [{ finish_reason, message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
}));
test("strict schema validates both identities, empty facts, and verbatim employment evidence", () => {
  for (const type of ["fresh_graduate", "career_switcher"] as const) {
    const expected = { ...fictionalProfile(type), employment_experience: "Fictional employer" };
    assert.deepEqual(validateExtractedProfile(expected, `${fictionalText}\nFictional employer`, type), expected);
    assert.equal(expected.confirmed_by_user, false);
  }
});
test("rejects invented facts, wrong types, missing/extra fields, arrays and automatic confirmation", () => {
  for (const bad of [
    null, [], { ...fictionalProfile(), skills: ["Python"] }, { ...fictionalProfile(), name: "Invented Name" },
    { ...fictionalProfile(), confirmed_by_user: true }, { ...fictionalProfile(), input_method: "online_form" },
    { ...fictionalProfile(), extra: "injected" }, { ...fictionalProfile(), education: [] },
    { ...fictionalProfile(), education: { school: "" } }, { ...fictionalProfile(), background: null },
    { ...fictionalProfile(), skills: "x".repeat(8001) },
  ]) assert.throws(() => validateExtractedProfile(bad, fictionalText, "fresh_graduate"), { code: "INVALID_PROFILE" });
});
test("disabled flag and missing key prevent all requests; disabled does not read a key", async () => {
  let calls = 0; let reads = 0;
  const transport = async () => { calls++; return response(); };
  const disabled = createGlmProfileClient({ settings: () => ({ enabled: false, get apiKey() { reads++; throw new Error("Key must not be read"); } }), transport });
  await assert.rejects(disabled.extract(fictionalText, "fresh_graduate"), { code: "LIVE_DISABLED" });
  assert.equal(reads, 0);
  const missing = createGlmProfileClient({ settings: () => ({ enabled: true }), transport });
  await assert.rejects(missing.extract(fictionalText, "fresh_graduate"), { code: "KEY_MISSING" });
  assert.equal(calls, 0);
  // Server settings are hard-disabled independently of any environment flag/key.
  assert.deepEqual(serverGlmSettings(), { enabled: false });
  const source = serverGlmSettings.toString();
  assert.doesNotMatch(source, /process\.env/);
  const serverClient = createGlmProfileClient({ settings: serverGlmSettings, transport });
  await assert.rejects(serverClient.extract(fictionalText, "fresh_graduate"), { code: "LIVE_DISABLED" });
  assert.equal(calls, 0);
});
test("mocked request has fixed URL/model, bounded tokens, untrusted JSON text and no default reasoning override", async () => {
  let calls = 0;
  const client = createGlmProfileClient({
    settings: () => ({ enabled: true, apiKey: "fictional-test-credential" }),
    transport: async (url, options) => {
      calls++;
      assert.equal(url, `${RUNPOD_GLM_BASE_URL}/chat/completions`);
      assert.equal(options?.redirect, "error");
      const body = JSON.parse(options?.body as string);
      assert.equal(body.model, "glm-5.3"); assert.equal(body.max_tokens, 2500);
      assert.equal(body.reasoning_effort, undefined);
      assert.match(body.messages[0].content, /UNTRUSTED/);
      assert.equal(JSON.parse(body.messages[1].content).cv_text, fictionalText);
      return response();
    },
  });
  assert.deepEqual(await client.extract(fictionalText, "fresh_graduate"), fictionalProfile());
  assert.equal(calls, 1);
});
test("reasoning_effort low is opt-in only after endpoint support is confirmed", async () => {
  const client = createGlmProfileClient({
    settings: () => ({ enabled: true, apiKey: "fictional-test-credential", lowReasoningSupported: true }),
    transport: async (_url, options) => { assert.equal(JSON.parse(options?.body as string).reasoning_effort, "low"); return response(); },
  });
  await client.extract(fictionalText, "fresh_graduate");
});
test("mocked auth, rate limit, server and invalid JSON failures are safe and never retried", async () => {
  for (const [status, expected] of [[401, "AUTH_ERROR"], [403, "AUTH_ERROR"], [429, "RATE_LIMITED"], [500, "UPSTREAM_ERROR"]] as const) {
    let calls = 0;
    const client = createGlmProfileClient({
      settings: () => ({ enabled: true, apiKey: "fictional-test-credential" }),
      transport: async () => { calls++; return new Response("private upstream data", { status }); },
    });
    await assert.rejects(client.extract(fictionalText, "fresh_graduate"), { code: expected, message: expected });
    assert.equal(calls, 1);
  }
  for (const result of [response("not json"), response({}, "length"), new Response("{}"), response("x".repeat(100_001)), response({ ...fictionalProfile(), confirmed_by_user: true })]) {
    const client = createGlmProfileClient({
      settings: () => ({ enabled: true, apiKey: "fictional-test-credential" }), transport: async () => result,
    });
    await assert.rejects(client.extract(fictionalText, "fresh_graduate"));
  }
});
test("mocked hanging transport times out and aborts once; oversized text never reaches transport", async () => {
  let calls = 0; let signal: AbortSignal | null = null;
  const client = createGlmProfileClient({
    settings: () => ({ enabled: true, apiKey: "fictional-test-credential" }), timeoutMs: 20,
    transport: async (_url, options) => { calls++; signal = options?.signal as AbortSignal; return new Promise(() => {}); },
  });
  await assert.rejects(client.extract("x".repeat(60_001), "fresh_graduate"), { code: "TEXT_TOO_LARGE" });
  assert.equal(calls, 0);
  await assert.rejects(client.extract(fictionalText, "fresh_graduate"), { code: "UPSTREAM_TIMEOUT" });
  assert.equal((signal as unknown as AbortSignal).aborted, true);
  assert.equal(calls, 1);
});
