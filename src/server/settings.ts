import "server-only";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt } from "./crypto";
import { db, schema } from "./db";
import { cached, kv } from "./redis";

/* ---------- esquemas de cada sección ---------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM");
const dayHours = z.array(z.object({ open: hhmm, close: hhmm })).max(3);

export const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  legalName: z.string().trim().max(120).default(""),
  taxId: z.string().trim().max(20).default(""), // NIF/CIF
  address: z.string().trim().max(200).default(""),
  city: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(10).default(""),
  phone: z.string().trim().max(30).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  timezone: z.string().default("Europe/Madrid"),
  /** 0 = domingo … 6 = sábado */
  hours: z.array(dayHours).length(7),
  notice: z.string().trim().max(200).default(""),
});

export const ordersSchema = z.object({
  enabled: z.boolean().default(true),
  pausedMessage: z.string().trim().max(160).default("Ahora mismo no aceptamos pedidos. Vuelve en un rato."),
  prepMinutes: z.number().int().min(5).max(120).default(15),
  slotMinutes: z.number().int().min(5).max(60).default(15),
  maxPerSlot: z.number().int().min(1).max(500).default(20),
  maxBurgersPerOrder: z.number().int().min(1).max(50).default(10),
  taxRateBp: z.number().int().min(0).max(3000).default(1000),
  pendingTimeoutMin: z.number().int().min(5).max(120).default(30),
  notifyEmail: z.string().trim().email().or(z.literal("")).default(""),
});

export const smtpSchema = z.object({
  host: z.string().trim().max(200).default(""),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().trim().max(200).default(""),
  /** cifrada; nunca se devuelve al navegador */
  passEnc: z.string().default(""),
  fromName: z.string().trim().max(80).default("Crea tu Burger"),
  fromEmail: z.string().trim().email().or(z.literal("")).default(""),
  replyTo: z.string().trim().email().or(z.literal("")).default(""),
});

export const paymentsSchema = z.object({
  cash: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  stripe: z
    .object({ enabled: z.boolean().default(false), publishableKey: z.string().default(""), secretKeyEnc: z.string().default(""), webhookSecretEnc: z.string().default("") })
    .default({ enabled: false, publishableKey: "", secretKeyEnc: "", webhookSecretEnc: "" }),
  paypal: z
    .object({
      enabled: z.boolean().default(false),
      env: z.enum(["sandbox", "live"]).default("sandbox"),
      clientId: z.string().default(""),
      clientSecretEnc: z.string().default(""),
      webhookId: z.string().default(""),
    })
    .default({ enabled: false, env: "sandbox", clientId: "", clientSecretEnc: "", webhookId: "" }),
  bizum: z
    .object({
      enabled: z.boolean().default(false),
      env: z.enum(["test", "live"]).default("test"),
      merchantCode: z.string().default(""),
      terminal: z.string().default("1"),
      secretKeyEnc: z.string().default(""),
    })
    .default({ enabled: false, env: "test", merchantCode: "", terminal: "1", secretKeyEnc: "" }),
});

const SCHEMAS = { store: storeSchema, orders: ordersSchema, smtp: smtpSchema, payments: paymentsSchema } as const;
export type SettingKey = keyof typeof SCHEMAS;
export type Settings = { [K in SettingKey]: z.infer<(typeof SCHEMAS)[K]> };

const H = [{ open: "12:00", close: "16:00" }, { open: "19:00", close: "23:30" }];
export const DEFAULTS: Settings = {
  store: storeSchema.parse({ name: "Crea tu Burger", hours: [H, H, H, H, H, H, H], city: "Madrid" }),
  orders: ordersSchema.parse({}),
  smtp: smtpSchema.parse({}),
  payments: paymentsSchema.parse({}),
};

const CACHE_KEY = "settings:v1";

export async function getSettings(): Promise<Settings> {
  return cached(CACHE_KEY, 60, async () => {
    const rows = await db().select().from(schema.settings).where(inArray(schema.settings.key, Object.keys(SCHEMAS)));
    const out = structuredClone(DEFAULTS) as Record<SettingKey, unknown>;
    for (const r of rows) {
      const k = r.key as SettingKey;
      const parsed = SCHEMAS[k].safeParse({ ...(DEFAULTS[k] as object), ...(r.value as object) });
      if (parsed.success) out[k] = parsed.data;
    }
    return out as Settings;
  });
}

export async function saveSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  const v = SCHEMAS[key].parse(value);
  await db()
    .insert(schema.settings)
    .values({ key, value: v })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: v, updatedAt: sql`now()` } });
  await kv().del(CACHE_KEY);
  return v as Settings[K];
}

/* ---------- secretos: primero variables de entorno, luego los guardados cifrados ---------- */

const dec = (v: string) => {
  try {
    return decrypt(v);
  } catch {
    return "";
  }
};

export async function paymentConfig() {
  const p = (await getSettings()).payments;
  const e = process.env;
  const stripe = {
    /** clave pública (pk_…): permite el formulario de tarjeta embebido */
    publishableKey: e.STRIPE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || p.stripe.publishableKey,
    secretKey: e.STRIPE_SECRET_KEY || dec(p.stripe.secretKeyEnc),
    webhookSecret: e.STRIPE_WEBHOOK_SECRET || dec(p.stripe.webhookSecretEnc),
  };
  const paypal = {
    env: (e.PAYPAL_ENV as "sandbox" | "live") || p.paypal.env,
    clientId: e.PAYPAL_CLIENT_ID || p.paypal.clientId,
    clientSecret: e.PAYPAL_CLIENT_SECRET || dec(p.paypal.clientSecretEnc),
    webhookId: e.PAYPAL_WEBHOOK_ID || p.paypal.webhookId,
  };
  const bizum = {
    env: (e.REDSYS_ENV as "test" | "live") || p.bizum.env,
    merchantCode: e.REDSYS_MERCHANT_CODE || p.bizum.merchantCode,
    terminal: e.REDSYS_TERMINAL || p.bizum.terminal,
    secretKey: e.REDSYS_SECRET_KEY || dec(p.bizum.secretKeyEnc),
  };
  return {
    cash: { enabled: p.cash.enabled },
    stripe: { ...stripe, enabled: p.stripe.enabled && !!stripe.secretKey, fromEnv: !!e.STRIPE_SECRET_KEY },
    paypal: { ...paypal, enabled: p.paypal.enabled && !!paypal.clientId && !!paypal.clientSecret, fromEnv: !!e.PAYPAL_CLIENT_ID },
    bizum: {
      ...bizum,
      enabled: p.bizum.enabled && !!bizum.merchantCode && !!bizum.secretKey,
      fromEnv: !!e.REDSYS_MERCHANT_CODE,
    },
  };
}

export async function smtpConfig() {
  const s = (await getSettings()).smtp;
  const e = process.env;
  return {
    host: e.SMTP_HOST || s.host,
    port: Number(e.SMTP_PORT || s.port),
    secure: e.SMTP_SECURE ? e.SMTP_SECURE === "true" : s.secure,
    user: e.SMTP_USER || s.user,
    pass: e.SMTP_PASS || dec(s.passEnc),
    fromName: s.fromName,
    fromEmail: e.SMTP_FROM || s.fromEmail || s.user,
    replyTo: s.replyTo,
  };
}

export { encrypt };

export { isOpenAt } from "@/lib/hours";
