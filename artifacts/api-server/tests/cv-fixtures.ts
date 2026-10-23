import { PDFDocument, StandardFonts, PDFName, PDFNumber, PDFHexString } from "pdf-lib";
import { createHash } from "node:crypto";

export const fictionalText = "Fictional Student | Fictional University | Bachelor of Science | Computer Science | Python, SQL | Fictional internship";
export function fictionalProfile(type: "fresh_graduate" | "career_switcher" = "fresh_graduate") {
  return {
    profile_type: type, input_method: "pdf_upload", confirmed_by_user: false,
    education: { school: "Fictional University", degree: "Bachelor of Science", major: "Computer Science", key_courses: "" },
    internship_experience: "Fictional internship", academic_experience: "", professional_certificates: "",
    personal_experience: "", interests_and_hobbies: "", employment_experience: "",
    other_experience: "", skills: "Python, SQL", name: "Fictional Student", role: "", background: "",
  };
}

// Test-only PDF generators: no real user data, URLs, credentials or downloaded PDFs.
export async function makePdf(text = fictionalText, pages = 1, imageOnly = false) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 0; n < pages; n++) {
    const page = doc.addPage([900, 1000]);
    if (imageOnly) {
      const png = await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64"));
      page.drawImage(png, { x: 10, y: 10, width: 100, height: 100 });
    } else if (text) page.drawText(text, { x: 10, y: 950, size: 9, font, maxWidth: 875, lineHeight: 12 });
  }
  return doc.save();
}

const padding = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
const md5 = (bytes: Uint8Array) => createHash("md5").update(bytes).digest();
function pad(password: string) { return Buffer.concat([Buffer.from(password), padding]).subarray(0, 32); }
function rc4(key: Uint8Array, input: Uint8Array) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) % 256; [s[i], s[j]] = [s[j], s[i]]; }
  let i = 0; j = 0;
  return Uint8Array.from(input, byte => { i = (i + 1) % 256; j = (j + s[i]) % 256; [s[i], s[j]] = [s[j], s[i]]; return byte ^ s[(s[i] + s[j]) % 256]; });
}

/** Valid Standard Security R2 dictionary; no text streams, so no encrypted payloads.
 * Tests both password-required and empty-user-password encrypted documents.
 * The fixed passwords below are fictional test data, not service credentials.
 */
export async function encryptedPdf(password = "fictional-test-password") {
  const doc = await PDFDocument.create();
  doc.addPage();
  const id = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const owner = rc4(md5(pad("fictional-owner")).subarray(0, 5), pad(password));
  const permissions = Buffer.alloc(4); permissions.writeInt32LE(-4);
  const key = md5(Buffer.concat([pad(password), owner, permissions, id])).subarray(0, 5);
  const user = rc4(key, padding);
  const dictionary = doc.context.obj({
    Filter: PDFName.of("Standard"), V: PDFNumber.of(1), R: PDFNumber.of(2),
    O: PDFHexString.of(Buffer.from(owner).toString("hex")),
    U: PDFHexString.of(Buffer.from(user).toString("hex")), P: PDFNumber.of(-4),
  });
  doc.context.trailerInfo.Encrypt = doc.context.register(dictionary);
  doc.context.trailerInfo.ID = doc.context.obj([PDFHexString.of(id.toString("hex")), PDFHexString.of(id.toString("hex"))]);
  // Remove unencrypted metadata strings; this is a minimal, genuinely encrypted blank PDF.
  doc.context.trailerInfo.Info = undefined;
  return doc.save({ useObjectStreams: false });
}
