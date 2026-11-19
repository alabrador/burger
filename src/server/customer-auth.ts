import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "./auth";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { db, schema } from "./db";
import { env } from "./env";
import { ApiError, clientIp } from "./http";
import { renderCode } from "./mail/code";
import { sendNow } from "./mail/outbox";
import { rateLimit } from "./ratelimit";
import { kv } from "./redis";
import { getSettings } from "./settings";
import { reportError } from "./errors";

/*
 * Cuentas de cliente con dos factores: contraseña + código de 6 cifras enviado al
 * correo en cada inicio de sesión (y al registrarse, para verificar el correo).
 */

const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const CODE_TTL = 10 * 60;
const CODE_TRIES = 5;
const RESEND_SEC = 45;
const MAX_FAILS = 8;
const LOCK_MIN = 15;
const DUMMY = "$argon2id$v=19$m=19456,t=2,p=1$TlhcBV7mV3PdNiaY58c0gg$5hhCLwt9GqtooYJHzZka9CyCx7Wdw9TQvzNytvNhI80";

export type Purpose = "register" | "login";
export const normEmail = (e: string) => e.trim().toLowerCase();

const secure = () => env.baseUrl.startsWith("https://");
export const customerCookie = () => (secure() ? "__Host-cb_cliente" : "cb_cliente");

async function limit(bucket: string, id: string, n: number, win: number) {
  const r = await rateLimit(bucket, id, n, win);
  if (!r.ok) throw new ApiError(429, "Demasiados intentos. Espera unos minutos.", "rate_limited", undefined, { "Retry-After": String(r.retryAfter) });
}

/* ---------- códigos por correo ---------- */

type Pending = { h: string; tries: number; data: Record<string, string | null> };
const codeKey = (p: Purpose, email: string) => `otp:${p}:${sha256(email)}`;
const codeHash = (email: string, code: string) => sha256(`${email}:${code}:${env.appSecret}`);

/** Genera un código, lo guarda (solo su hash) y lo envía. Respeta una espera entre envíos. */
export async function sendCode(p: Purpose, email: string, name: string, data: Pending["data"] = {}) {
  if (!(await kv().setNx(`otpcd:${p}:${sha256(email)}`, "1", RESEND_SEC)))
    throw new ApiError(429, `Espera ${RESEND_SEC} segundos antes de pedir otro código.`, "resend_wait", undefined, { "Retry-After": String(RESEND_SEC) });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await kv().set(codeKey(p, email), JSON.stringify({ h: codeHash(email, code), tries: 0, data } satisfies Pending), CODE_TTL);
  const store = (await getSettings()).store;
  try {
    await sendNow({ to: email, ...renderCode(code, p, name, store) });
  } catch (e) {
    await reportError("mail", e, { path: "código de acceso de cliente" });
    await kv().del(codeKey(p, email), `otpcd:${p}:${sha256(email)}`);
    throw new ApiError(503, "No hemos podido enviar el correo. Inténtalo en unos minutos.", "mail_failed");
  }
}

/** Comprueba el código. Tras 5 fallos el código deja de valer. Devuelve los datos guardados con él. */
export async function checkCode(p: Purpose, email: string, code: string): Promise<Pending["data"]> {
  const key = codeKey(p, email);
  const raw = await kv().get(key);
  if (!raw) throw new ApiError(410, "El código ha caducado. Pide uno nuevo.", "code_expired");
  const pend = JSON.parse(raw) as Pending;
  if (!/^\d{6}$/.test(code) || !safeEqual(pend.h, codeHash(email, code))) {
    pend.tries++;
    if (pend.tries >= CODE_TRIES) {
      await kv().del(key);
      throw new ApiError(410, "Demasiados intentos con este código. Pide uno nuevo.", "code_expired");
    }
    await kv().set(key, JSON.stringify(pend), CODE_TTL);
    throw new ApiError(401, "Código incorrecto", "bad_code", { left: CODE_TRIES - pend.tries });
  }
  await kv().del(key); // un solo uso
  return pend.data;
}

/* ---------- registro e inicio de sesión ---------- */

export async function startRegister(req: NextRequest, b: { name: string; email: string; phone?: string; password: string; marketing?: boolean }) {
  const email = normEmail(b.email);
  await limit("reg-ip", clientIp(req), 10, 3600);
  await limit("reg-email", sha256(email), 5, 3600);
  const [c] = await db().select({ pw: schema.customers.passwordHash }).from(schema.customers).where(eq(schema.customers.email, email));
  if (c?.pw) throw new ApiError(409, "Ya hay una cuenta con este correo. Inicia sesión.", "exists");
  const pw = await hashPassword(b.password);
  await sendCode("register", email, b.name, { name: b.name, phone: b.phone || null, pw, marketing: b.marketing ? "1" : null });
}

/** Paso 1 del inicio de sesión: contraseña. Si es correcta, se envía el código al correo. */
export async function startLogin(req: NextRequest, rawEmail: string, password: string) {
  const email = normEmail(rawEmail);
  await limit("clogin-ip", clientIp(req), 20, 900);
  await limit("clogin-email", sha256(email), 10, 900);
  const [c] = await db().select().from(schema.customers).where(and(eq(schema.customers.email, email), isNull(schema.customers.anonymizedAt)));
  const bad = () => new ApiError(401, "Correo o contraseña incorrectos", "bad_credentials");
  if (!c?.passwordHash) {
    await verifyPassword(DUMMY, password); // mismo tiempo exista o no la cuenta
    throw bad();
  }
  if (c.lockedUntil && c.lockedUntil > new Date())
    throw new ApiError(423, "Cuenta bloqueada unos minutos por intentos fallidos.", "locked");
  if (!(await verifyPassword(c.passwordHash, password))) {
    const fails = c.failedLogins + 1;
    await db()
      .update(schema.customers)
      .set({ failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : c.lockedUntil })
      .where(eq(schema.customers.id, c.id));
    throw bad();
  }
  await sendCode("login", email, c.name, { id: c.id });
}

/** Paso 2 (registro o inicio de sesión): código correcto → cuenta lista y sesión abierta. */
export async function finish(req: NextRequest, res: NextResponse, p: Purpose, rawEmail: string, code: string) {
  const email = normEmail(rawEmail);
  await limit("ccode-ip", clientIp(req), 40, 900);
  const data = await checkCode(p, email, code);
  let id: string;
  if (p === "register") {
    const [c] = await db()
      .insert(schema.customers)
      .values({ email, name: data.name!, phone: data.phone, passwordHash: data.pw, emailVerifiedAt: sql`now()`, marketingOptIn: data.marketing === "1", lastLoginAt: sql`now()` })
      .onConflictDoUpdate({
        // ya había pedido como invitado: se convierte en cuenta y conserva su historial
        target: schema.customers.email,
        set: { name: data.name!, phone: sql`coalesce(${data.phone}, ${schema.customers.phone})`, passwordHash: data.pw, emailVerifiedAt: sql`now()`, anonymizedAt: null, failedLogins: 0, lockedUntil: null, lastLoginAt: sql`now()` },
      })
      .returning({ id: schema.customers.id });
    id = c.id;
    // pedidos anteriores hechos con ese correo pasan a la cuenta
    await db().update(schema.orders).set({ customerId: id }).where(and(eq(schema.orders.customerEmail, email), isNull(schema.orders.customerId)));
  } else {
    id = data.id!;
    await db().update(schema.customers).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: sql`now()` }).where(eq(schema.customers.id, id));
  }
  await createSession(res, id, req);
}

/* ---------- sesiones ---------- */

export type Customer = { sid: string; id: string; email: string; name: string; phone: string | null; exp: number };

async function createSession(res: NextResponse, customerId: string, req: NextRequest) {
  const token = randomToken(32);
  const sid = sha256(token);
  const exp = Date.now() + SESSION_MS;
  await db()
    .insert(schema.customerSessions)
    .values({ id: sid, customerId, ip: clientIp(req), userAgent: (req.headers.get("user-agent") || "").slice(0, 200), expiresAt: new Date(exp) });
  res.cookies.set(customerCookie(), token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: SESSION_MS / 1000 });
}

export async function getCustomer(req: NextRequest): Promise<Customer | null> {
  const token = req.cookies.get(customerCookie())?.value;
  if (!token || token.length > 100) return null;
  const sid = sha256(token);
  const hit = await kv().get(`csess:${sid}`).catch(() => null);
  let c: Customer | null = hit ? (JSON.parse(hit) as Customer) : null;
  if (!c) {
    const [row] = await db()
      .select({ s: schema.customerSessions, c: schema.customers })
      .from(schema.customerSessions)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.customerSessions.customerId))
      .where(and(eq(schema.customerSessions.id, sid), isNull(schema.customers.anonymizedAt)));
    if (!row || !row.c.passwordHash) return null;
    c = { sid, id: row.c.id, email: row.c.email, name: row.c.name, phone: row.c.phone, exp: row.s.expiresAt.getTime() };
    await kv().set(`csess:${sid}`, JSON.stringify(c), 300);
  }
  if (Date.now() > c.exp) {
    await endSession(sid);
    return null;
  }
  return c;
}

export async function endSession(sid: string) {
  await kv().del(`csess:${sid}`);
  await db().delete(schema.customerSessions).where(eq(schema.customerSessions.id, sid));
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Las peticiones que cambian algo deben venir de la propia web (la cookie es SameSite=Lax). */
export function checkOrigin(req: NextRequest) {
  if (!sameOrigin(req)) throw new ApiError(403, "Origen no permitido", "bad_origin");
}

export async function requireCustomer(req: NextRequest) {
  const c = await getCustomer(req);
  if (!c) throw new ApiError(401, "Inicia sesión para continuar", "unauthenticated");
  return c;
}

/** Reenvía un código nuevo para el mismo registro o inicio de sesión en curso. */
export async function resendCode(req: NextRequest, p: Purpose, rawEmail: string) {
  const email = normEmail(rawEmail);
  await limit("cresend-ip", clientIp(req), 10, 900);
  const raw = await kv().get(codeKey(p, email));
  if (!raw) throw new ApiError(410, "La solicitud ha caducado. Vuelve a empezar.", "code_expired");
  const pend = JSON.parse(raw) as Pending;
  let name = pend.data.name ?? "";
  if (!name && pend.data.id) {
    const [c] = await db().select({ name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, pend.data.id));
    name = c?.name ?? "";
  }
  await sendCode(p, email, name, pend.data);
}
