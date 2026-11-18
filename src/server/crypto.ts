import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Token aleatorio en base64url (por defecto 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** HMAC-SHA256 con APP_SECRET, recortado y en base64url. Se usa en QR y enlaces. */
export function sign(data: string, len = 22): string {
  return createHmac("sha256", env.appSecret).update(data).digest("base64url").slice(0, len);
}

export function verify(data: string, sig: string, len = 22): boolean {
  return typeof sig === "string" && sig.length === len && safeEqual(sign(data, len), sig);
}

/** Cifrado AES-256-GCM para secretos guardados en la base de datos. Formato v1:iv:tag:datos. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", env.encryptionKey, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decrypt(blob: string | null | undefined): string {
  if (!blob) return "";
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Secreto cifrado con formato desconocido");
  const d = createDecipheriv("aes-256-gcm", env.encryptionKey, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
