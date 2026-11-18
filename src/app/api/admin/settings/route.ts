import { z } from "zod";
import { admin } from "@/server/admin";
import { encrypt } from "@/server/crypto";
import { env } from "@/server/env";
import { body, json } from "@/server/http";
import { getSettings, ordersSchema, paymentConfig, saveSetting, smtpConfig, storeSchema } from "@/server/settings";

/** Devuelve la configuración sin secretos: solo si están puestos y si vienen de variables de entorno. */
export const GET = admin("settings.edit", async () => {
  const [s, pay, smtp] = await Promise.all([getSettings(), paymentConfig(), smtpConfig()]);
  const { passEnc, ...smtpRest } = s.smtp;
  const base = env.baseUrl;
  return json({
    store: s.store,
    orders: s.orders,
    smtp: { ...smtpRest, hasPass: !!passEnc, fromEnv: !!process.env.SMTP_HOST, effectiveHost: smtp.host },
    payments: {
      cash: s.payments.cash,
      stripe: { enabled: s.payments.stripe.enabled, publishableKey: pay.stripe.publishableKey, hasSecretKey: !!pay.stripe.secretKey, hasWebhookSecret: !!pay.stripe.webhookSecret, fromEnv: pay.stripe.fromEnv, ready: pay.stripe.enabled, webhookUrl: `${base}/api/payments/stripe/webhook` },
      paypal: { enabled: s.payments.paypal.enabled, env: pay.paypal.env, clientId: pay.paypal.clientId, hasClientSecret: !!pay.paypal.clientSecret, webhookId: pay.paypal.webhookId, fromEnv: pay.paypal.fromEnv, ready: pay.paypal.enabled, webhookUrl: `${base}/api/payments/paypal/webhook` },
      bizum: { enabled: s.payments.bizum.enabled, env: pay.bizum.env, merchantCode: pay.bizum.merchantCode, terminal: pay.bizum.terminal, hasSecretKey: !!pay.bizum.secretKey, fromEnv: pay.bizum.fromEnv, ready: pay.bizum.enabled, notifyUrl: `${base}/api/payments/redsys/notify` },
    },
  });
});

const secret = z.string().max(500).optional(); // vacío o ausente = no cambiar
const put = z.discriminatedUnion("section", [
  z.object({ section: z.literal("store"), value: storeSchema }),
  z.object({ section: z.literal("orders"), value: ordersSchema }),
  z.object({
    section: z.literal("smtp"),
    value: z.object({
      host: z.string().trim().max(200).regex(/^[a-zA-Z0-9.-]*$/, "Servidor no válido"),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string().trim().max(200),
      pass: secret,
      fromName: z.string().trim().min(1).max(80),
      fromEmail: z.string().trim().email().or(z.literal("")),
      replyTo: z.string().trim().email().or(z.literal("")),
    }),
  }),
  z.object({
    section: z.literal("payments"),
    value: z.object({
      cash: z.object({ enabled: z.boolean() }),
      stripe: z.object({ enabled: z.boolean(), publishableKey: z.string().trim().max(200).refine((v) => !v || /^pk_(test|live)_/.test(v), "La clave pública de Stripe empieza por pk_").default(""), secretKey: secret.refine((v) => !v || /^(sk|rk)_(test|live)_/.test(v), "Clave secreta de Stripe no válida"), webhookSecret: secret.refine((v) => !v || v.startsWith("whsec_"), "Debe empezar por whsec_") }),
      paypal: z.object({ enabled: z.boolean(), env: z.enum(["sandbox", "live"]), clientId: z.string().trim().max(200), clientSecret: secret, webhookId: z.string().trim().max(100) }),
      bizum: z.object({ enabled: z.boolean(), env: z.enum(["test", "live"]), merchantCode: z.string().trim().regex(/^\d{0,12}$/, "Solo números"), terminal: z.string().trim().regex(/^\d{1,3}$/), secretKey: secret.refine((v) => !v || Buffer.from(v, "base64").length === 24, "La clave SHA-256 de Redsys debe ser de 24 bytes en base64") }),
    }),
  }),
]);

const keep = (next: string | undefined, prev: string) => (next ? encrypt(next) : prev);

export const PUT = admin("settings.edit", async (req, _me, log) => {
  const b = await body(req, put, 16 * 1024);
  const cur = await getSettings();
  if (b.section === "store") await saveSetting("store", b.value);
  else if (b.section === "orders") await saveSetting("orders", b.value);
  else if (b.section === "smtp") {
    const { pass, ...v } = b.value;
    await saveSetting("smtp", { ...v, passEnc: keep(pass, cur.smtp.passEnc) });
  } else {
    const v = b.value;
    const p = cur.payments;
    await saveSetting("payments", {
      cash: v.cash,
      stripe: { enabled: v.stripe.enabled, publishableKey: v.stripe.publishableKey, secretKeyEnc: keep(v.stripe.secretKey, p.stripe.secretKeyEnc), webhookSecretEnc: keep(v.stripe.webhookSecret, p.stripe.webhookSecretEnc) },
      paypal: { enabled: v.paypal.enabled, env: v.paypal.env, clientId: v.paypal.clientId, clientSecretEnc: keep(v.paypal.clientSecret, p.paypal.clientSecretEnc), webhookId: v.paypal.webhookId },
      bizum: { enabled: v.bizum.enabled, env: v.bizum.env, merchantCode: v.bizum.merchantCode, terminal: v.bizum.terminal, secretKeyEnc: keep(v.bizum.secretKey, p.bizum.secretKeyEnc) },
    });
  }
  // nunca registramos secretos en la auditoría
  const redacted = JSON.parse(JSON.stringify(b.value, (k, val) => (/pass|secret/i.test(k) && val ? "•••" : val)));
  await log(`settings.${b.section}`, "settings", b.section, redacted);
  return json({ ok: true });
});
