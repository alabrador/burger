import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { admin } from "@/server/admin";
import { checkTotp, destroyUserSessions, newTotpSecret, totpFor, verifyPassword } from "@/server/auth";
import { decrypt, encrypt } from "@/server/crypto";
import { db, schema } from "@/server/db";
import { ApiError, body, json, limit } from "@/server/http";
import { kv } from "@/server/redis";

/** Paso 1: genera un secreto temporal y su QR para la app de autenticación. */
export const GET = admin(null, async (_req, me) => {
  const secret = newTotpSecret();
  await kv().set(`totp-setup:${me.id}`, encrypt(secret), 600);
  const uri = totpFor(secret, me.email).toString();
  return json({ secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
});

/** Paso 2: confirma con un código y activa la 2FA. */
export const POST = admin(null, async (req, me, log) => {
  await limit(req, "2fa", 10, 600, me.id);
  const { code } = await body(req, z.object({ code: z.string().regex(/^\d{6}$/) }), 512);
  const enc = await kv().get(`totp-setup:${me.id}`);
  if (!enc) throw new ApiError(410, "El código QR caducó. Vuelve a empezar.", "expired");
  if (!(await checkTotp(me.id, decrypt(enc), code))) throw new ApiError(422, "Código incorrecto", "bad_code");
  await db().update(schema.staffUsers).set({ totpSecret: enc, totpEnabled: true }).where(eq(schema.staffUsers.id, me.id));
  await kv().del(`totp-setup:${me.id}`);
  await destroyUserSessions(me.id); // obliga a entrar de nuevo con 2FA
  await log("account.2fa_enabled", "staff_user", me.id);
  return json({ ok: true });
});

/** Desactivar 2FA: pide contraseña y un código vigente. */
export const DELETE = admin(null, async (req, me, log) => {
  await limit(req, "2fa", 10, 600, me.id);
  const b = await body(req, z.object({ password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/) }), 1024);
  const [u] = await db().select().from(schema.staffUsers).where(eq(schema.staffUsers.id, me.id));
  if (!u?.totpEnabled || !(await verifyPassword(u.passwordHash, b.password)) || !(await checkTotp(u.id, decrypt(u.totpSecret), b.code)))
    throw new ApiError(401, "Contraseña o código incorrectos", "bad_credentials");
  await db().update(schema.staffUsers).set({ totpSecret: null, totpEnabled: false }).where(eq(schema.staffUsers.id, me.id));
  await destroyUserSessions(me.id);
  await log("account.2fa_disabled", "staff_user", me.id);
  return json({ ok: true });
});
