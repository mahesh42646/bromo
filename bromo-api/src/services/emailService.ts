import fs from "node:fs";
import path from "node:path";
import { uploadsRoot, publicUrlForUploadRelative } from "../utils/uploadFiles.js";

type EmailInput = {
  to: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
};

export async function sendTransactionalEmail(input: EmailInput): Promise<void> {
  const outboxDir = path.join(uploadsRoot(), "email-outbox");
  fs.mkdirSync(outboxDir, {recursive: true});
  const file = path.join(outboxDir, `${Date.now()}-${input.to.replace(/[^a-z0-9]/gi, "_")}.json`);
  fs.writeFileSync(file, JSON.stringify({...input, createdAt: new Date().toISOString()}, null, 2));
  console.info(`[email] queued transactional email to ${input.to}: ${input.subject}`);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function generatePartnerCertificatePdf(input: {
  storeId: string;
  ownerName: string;
  storeName: string;
  approvedAt: Date;
}): string {
  const rel = `certificates/${input.storeId}/partner-certificate-${input.approvedAt.getTime()}.pdf`;
  const abs = path.join(uploadsRoot(), ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  const lines = [
    "INSAY BUSINESS PARTNER CERTIFICATE",
    `This certifies that ${input.ownerName}`,
    `representing ${input.storeName}`,
    "is now an official Insay Business Partner.",
    `Approved at: ${input.approvedAt.toISOString()}`,
  ];
  const text = lines.map((line, index) => `BT /F1 16 Tf 72 ${720 - index * 36} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${obj}\n`;
  }
  const xrefAt = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  fs.writeFileSync(abs, body);
  return publicUrlForUploadRelative(rel);
}
