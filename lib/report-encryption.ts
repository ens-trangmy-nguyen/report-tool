import crypto from "node:crypto";

import type { ReportLog } from "@/lib/types";

const PREFIX = "enc:v1:";
const ENCRYPTED_FIELDS = ["content", "output", "blocker", "follow_up"] as const;

type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing ENCRYPTION_KEY server environment variable.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptReportField(value?: string | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptReportField(value?: string | null) {
  if (!value) return value ?? null;
  if (!value.startsWith(PREFIX)) return value;

  const payload = value.slice(PREFIX.length);
  const [ivBase64, tagBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted report field payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptReportPayload<T extends Partial<Record<EncryptedField, string | null | undefined>>>(
  payload: T,
) {
  const next = { ...payload };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in next) {
      next[field] = encryptReportField(next[field]) as T[typeof field];
    }
  }
  return next;
}

export function decryptReport<T extends ReportLog | null>(report: T): T {
  if (!report) return report;
  return {
    ...report,
    blocker: decryptReportField(report.blocker),
    content: decryptReportField(report.content) ?? "",
    follow_up: decryptReportField(report.follow_up),
    output: decryptReportField(report.output),
  };
}

export function decryptReports(reports: ReportLog[]) {
  return reports.map((report) => decryptReport(report));
}
