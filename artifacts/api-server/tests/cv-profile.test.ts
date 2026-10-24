import { test } from "node:test";
import assert from "node:assert/strict";
import { validateExtractedProfile } from "../src/lib/cv-profile.ts";
import { fictionalProfile, fictionalText } from "./cv-fixtures.ts";

test("shared profile validation accepts both identities and verbatim employment evidence", () => {
  for (const type of ["fresh_graduate", "career_switcher"] as const) {
    const expected = { ...fictionalProfile(type), employment_experience: "Fictional employer" };
    assert.deepEqual(validateExtractedProfile(expected, `${fictionalText}\nFictional employer`, type), expected);
    assert.equal(expected.confirmed_by_user, false);
  }
});

test("shared profile validation rejects invented facts, wrong types, extra fields and automatic confirmation", () => {
  for (const bad of [
    null, [], { ...fictionalProfile(), skills: ["Python"] }, { ...fictionalProfile(), name: "Invented Name" },
    { ...fictionalProfile(), confirmed_by_user: true }, { ...fictionalProfile(), input_method: "online_form" },
    { ...fictionalProfile(), extra: "injected" }, { ...fictionalProfile(), education: [] },
    { ...fictionalProfile(), education: { school: "" } }, { ...fictionalProfile(), background: null },
    { ...fictionalProfile(), skills: "x".repeat(8001) },
  ]) assert.throws(() => validateExtractedProfile(bad, fictionalText, "fresh_graduate"), { code: "INVALID_PROFILE" });
});
