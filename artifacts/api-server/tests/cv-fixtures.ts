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

/** Generates a minimal fictional PDF with an explicit Unicode ToUnicode map. */
export function makeUnicodePdf(text: string): Buffer {
  const characters = [...text];
  if (!characters.length || characters.some(character => character.codePointAt(0)! > 0xffff)) {
    throw new Error("Unicode PDF fixture requires non-empty BMP text");
  }
  const code = (value: number) => value.toString(16).padStart(4, "0").toUpperCase();
  const glyphCodes = new Map([...new Set(characters)].map((character, index) => [character, index + 1]));
  const content = `BT /F0 12 Tf 40 1150 Td <${characters.map(character => code(glyphCodes.get(character)!)).join("")}> Tj ET`;
  const mappings = [...glyphCodes].map(([character, glyph]) => `<${code(glyph)}> <${code(character.codePointAt(0)!)}>`);
  const cmapBlocks = [];
  for (let offset = 0; offset < mappings.length; offset += 100) {
    const block = mappings.slice(offset, offset + 100);
    cmapBlocks.push(`${block.length} beginbfchar\n${block.join("\n")}\nendbfchar`);
  }
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${cmapBlocks.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2400 1200] /Resources << /Font << /F0 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 >>",
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function makeMultiColumnPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const rows: Array<[number, number, string]> = [
    [20, 760, "Jordan Miller"],
    [20, 720, "EDUCATION"], [320, 720, "SKILLS"],
    [20, 695, "University of Malaya"], [320, 695, "Python"],
    [20, 670, "Bachelor of Science in Computer Science"], [320, 670, "SQL"],
    [20, 645, "Graduated 2024"], [320, 645, "React"],
    [20, 590, "WORK EXPERIENCE"], [320, 590, "LEADERSHIP"],
    [20, 565, "Northstar Analytics | Data Intern | 2023-2024"], [320, 565, "Campus Data Club | Coordinator"],
  ];
  for (const [x, y, text] of rows) page.drawText(text, { x, y, size: 10, font });
  return doc.save();
}

export async function makeUnusualReadingOrderPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const rows: Array<[number, number, string]> = [
    [320, 720, "SKILLS"],
    [320, 695, "Python"],
    [320, 670, "SQL"],
    [20, 760, "Jordan Miller"],
    [20, 720, "EDUCATION"],
    [20, 695, "Example Institute"],
    [20, 670, "Bachelor of Science in Computer Science"],
  ];
  for (const [x, y, text] of rows) page.drawText(text, { x, y, size: 10, font });
  return doc.save();
}

export async function makePdfPages(pageTexts: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage([900, 1000]);
    if (text) page.drawText(text, { x: 10, y: 950, size: 9, font, maxWidth: 875, lineHeight: 12 });
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
