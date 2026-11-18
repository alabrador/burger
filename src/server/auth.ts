import "server-only";
import { hash, verify as argonVerify } from "@node-rs/argon2";
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import * as OTPAuth from "otpauth";
import { audit } from "./audit";
import { decrypt, randomToken, sha256 } from "./crypto";
import { db, schema } from "./db";
import { env } from "./env";
import { ApiError, clientIp } from "./http";
import { rateLimit } from "./ratelimit";
import { kv } from "./redis";

export type Role = (typeof schema.staffRole.enumValues)[number];

/* ---------- permisos por rol ---------- */

const ALL: Role[] = ["owner", "admin", "manager", "kitchen", "cashier"];
export const PERMS = {
  dashboard: ["owner", "admin", "manager"],
  "orders.view": ALL,
  "orders.update": ALL,
  "orders.refund": ["owner", "admin", "manager"],
  "products.edit": ["owner", "admin", "manager"],
  "customers.view": ["owner", "admin", "manager", "cashier"],
  "customers.delete": ["owner", "admin"],
  "payments.view": ["owner", "admin", "manager"],
  "coupons.edit": ["owner", "admin", "manager"],
  "settings.edit": ["owner", "admin"],
  "users.manage": ["owner", "admin"],
  "audit.view": ["owner", "admin"],
} satisfies Record<string, Role[]>;
export type Perm = keyof typeof PERMS;
export const can = (role: Role, p: Perm) => (PERMS[p] as Role[]).includes(role);

/* ---------- contraseñas ---------- */

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
export const hashPassword = (p: string) => hash(p, ARGON);
const DUMMY = "$argon2id$v=19$m=19456,t=2,p=1$TlhcBV7mV3PdNiaY58c0gg$5hhCLwt9GqtooYJHzZka9CyCx7Wdw9TQvzNytvNhI80";
export async function verifyPassword(h: string, p: string) {
  try {
    return await argonVerify(h, p);
  } catch {
    return false;
  }
}

/** Política: 10+ caracteres con letras y números, y no trivial. */
export function passwordProblem(p: string): string | null {
  if (p.length < 10) return "Mínimo 10 caracteres";
  if (p.length > 128) return "Máximo 128 caracteres";
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return "Debe tener letras y números";
  if (/^(.)\1+$/.test(p) || /password|contraseña|123456|qwerty/i.test(p)) return "Contraseña demasiado común";
  return null;
}

/* ---------- 2FA (TOTP) ---------- */

export function totpFor(secretB32: string, label: string) {
  return new OTPAuth.TOTP({ issuer: "Crea tu Burger", label, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretB32) });
}
export const newTotpSecret = () => new OTPAuth.Secret({ size: 20 }).base32;

/** Valida un código y evita reutilizarlo (anti‑replay) durante 90 s. */
export async function checkTotp(userId: string, secretB32: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const delta = totpFor(secretB32, "x").validate({ token: code, window: 1 });
  if (delta === null) return false;
  return kv().setNx(`totp:${userId}:${code}`, "1", 90);
}

/* ---------- sesiones ---------- */

const IDLE_MS = 2 * 60 * 60 * 1000; // 2 h sin actividad
const ABS_MS = 12 * 60 * 60 * 1000; // 12 h máximo
export const secureCookies = () => env.baseUrl.startsWith("https://");
export const cookieName = () => (secureCookies() ? "__Host-cb_admin" : "cb_admin");

export type Staff = {
  sid: string;
  id: string;
  email: string;
  name: string;
  role: Role;
  csrf: string;
  totpEnabled: boolean;
  exp: number;
  seen: number;
};

export async function createSession(res: NextResponse, user: typeof schema.staffUsers.$inferSelect, req: NextRequest) {
  const token = randomToken(32);
  const sid = sha256(token);
  const csrf = randomToken(18);
  const now = Date.now();
  await db()
    .insert(schema.sessions)
    .values({ id: sid, userId: user.id, csrf, ip: clientIp(req), userAgent: (req.headers.get("user-agent") || "").slice(0, 200), expiresAt: new Date(now + ABS_MS) });
  const s: Staff = { sid, id: user.id, email: user.email, name: user.name, role: user.role, csrf, totpEnabled: user.totpEnabled, exp: now + ABS_MS, seen: now };
  await kv().set(`sess:${sid}`, JSON.stringify(s), Math.ceil(IDLE_MS / 1000));
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    maxAge: ABS_MS / 1000,
  });
  return s;
}

export async function destroySession(sid: string) {
  await kv().del(`sess:${sid}`);
  await db().delete(schema.sessions).where(eq(schema.sessions.id, sid));
}

/** Cierra todas las sesiones de un usuario (cambio de contraseña, baja, cambio de rol). */
export async function destroyUserSessions(userId: string, exceptSid?: string) {
  const rows = await db().select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, userId));
  const ids = rows.map((r) => r.id).filter((id) => id !== exceptSid);
  if (ids.length) await kv().del(...ids.map((i) => `sess:${i}`));
  for (const id of ids) await db().delete(schema.sessions).where(eq(schema.sessions.id, id));
}

export async function getStaff(req: NextRequest): Promise<Staff | null> {
  const token = req.cookies.get(cookieName())?.value;
  if (!token || token.length > 100) return null;
  const sid = sha256(token);
  const now = Date.now();
  let s: Staff | null = null;
  const hit = await kv().get(`sess:${sid}`).catch(() => null);
  if (hit) s = JSON.parse(hit) as Staff;
  else {
    const [row] = await db()
      .select({ sess: schema.sessions, user: schema.staffUsers })
      .from(schema.sessions)
      .innerJoin(schema.staffUsers, eq(schema.staffUsers.id, schema.sessions.userId))
      .where(and(eq(schema.sessions.id, sid), eq(schema.staffUsers.active, true)));
    if (!row) return null;
    s = {
      sid,
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      role: row.user.role,
      csrf: row.sess.csrf,
      totpEnabled: row.user.totpEnabled,
      exp: row.sess.expiresAt.getTime(),
      seen: row.sess.lastSeenAt.getTime(),
    };
  }
  if (now > s.exp || now - s.seen > IDLE_MS) {
    await destroySession(sid);
    return null;
  }
  if (now - s.seen > 60_000 || !hit) {
    s.seen = now;
    await kv().set(`sess:${sid}`, JSON.stringify(s), Math.ceil(IDLE_MS / 1000));
    db().update(schema.sessions).set({ lastSeenAt: new Date(now) }).where(eq(schema.sessions.id, sid)).catch(() => {});
  }
  return s;
}

/** Comprueba Origin del navegador: debe ser el propio sitio. */
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

/** Sesión obligatoria + permiso + CSRF (doble envío) en métodos que modifican. */
export async function requireStaff(req: NextRequest, perm?: Perm): Promise<Staff> {
  const s = await getStaff(req);
  if (!s) throw new ApiError(401, "Sesión caducada. Vuelve a iniciar sesión.", "unauthenticated");
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!sameOrigin(req)) throw new ApiError(403, "Origen no permitido", "bad_origin");
    if (req.headers.get("x-csrf-token") !== s.csrf) throw new ApiError(403, "Token CSRF no válido", "csrf");
  }
  if (perm && !can(s.role, perm)) throw new ApiError(403, "No tienes permiso para esta acción", "forbidden");
  return s;
}

/* ---------- login ---------- */

const MAX_FAILS = 8;
const LOCK_MIN = 15;

export async function login(req: NextRequest, email: string, password: string, code?: string) {
  const ip = clientIp(req);
  const e = email.toLowerCase().trim();
  const [byIp, byEmail] = await Promise.all([rateLimit("login-ip", ip, 20, 900), rateLimit("login-email", sha256(e), 10, 900)]);
  if (!byIp.ok || !byEmail.ok)
    throw new ApiError(429, "Demasiados intentos. Espera unos minutos.", "rate_limited", undefined, { "Retry-After": String(byIp.retryAfter || byEmail.retryAfter) });

  const [u] = await db().select().from(schema.staffUsers).where(eq(schema.staffUsers.email, e));
  const fail = async (reason: string) => {
    if (u) {
      const fails = u.failedLogins + 1;
      await db()
        .update(schema.staffUsers)
        .set({ failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : u.lockedUntil })
        .where(eq(schema.staffUsers.id, u.id));
    }
    await audit(u ? { id: u.id, email: u.email } : { email: e }, "login.failed", "staff_user", u?.id, { reason }, ip);
    throw new ApiError(401, "Correo, contraseña o código incorrectos", "bad_credentials");
  };

  if (!u) {
    await verifyPassword(DUMMY, password); // mismo tiempo de respuesta exista o no el usuario
    return fail("unknown");
  }
  if (!u.active) return fail("inactive");
  if (u.lockedUntil && u.lockedUntil > new Date())
    throw new ApiError(423, `Cuenta bloqueada temporalmente por intentos fallidos. Prueba después de las ${u.lockedUntil.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}.`, "locked");
  if (!(await verifyPassword(u.passwordHash, password))) return fail("password");
  if (u.totpEnabled) {
    if (!code) return { needTotp: true as const, user: null };
    if (!(await checkTotp(u.id, decrypt(u.totpSecret), code))) return fail("totp");
  }
  await db()
    .update(schema.staffUsers)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: sql`now()` })
    .where(eq(schema.staffUsers.id, u.id));
  await audit({ id: u.id, email: u.email }, "login.ok", "staff_user", u.id, null, ip);
  return { needTotp: false as const, user: u };
}
