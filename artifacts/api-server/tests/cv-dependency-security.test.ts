import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import app from "../src/app.ts";

const require = createRequire(import.meta.url);
// Resolve the actual transitive copy used by Express, not a test-only dependency.
const expressRequire = createRequire(require.resolve("express"));
const proxyAddr = expressRequire("proxy-addr") as {
  compile: (range: string) => (address: string) => boolean;
};

test("actual app keeps proxy trust disabled; caller forwarding headers are not identity", () => {
  assert.equal(app.get("trust proxy"), false);
});

test("Express proxy-addr rejects the short mapped IPv6 trust-subnet bypass", () => {
  const unsafeShortRange = proxyAddr.compile("::ffff:10.0.0.0/8");
  assert.equal(unsafeShortRange("203.0.113.9"), false);
  const normal = proxyAddr.compile("10.0.0.0/8");
  assert.equal(normal("10.1.2.3"), true);
  assert.equal(normal("203.0.113.9"), false);
  const mapped = proxyAddr.compile("::ffff:10.0.0.0/104");
  assert.equal(mapped("10.1.2.3"), true);
  assert.equal(mapped("203.0.113.9"), false);
});
