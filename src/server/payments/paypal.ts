import "server-only";
import { kv } from "../redis";
import { paymentConfig } from "../settings";

async function cfg() {
  const c = (await paymentConfig()).paypal;
  if (!c.clientId || !c.clientSecret) throw new Error("PayPal no configurado");
  return { ...c, base: c.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com" };
}

async function token() {
  const c = await cfg();
  const key = `paypal:tok:${c.env}:${c.clientId.slice(0, 12)}`;
  const hit = await kv().get(key);
  if (hit) return { c, t: hit };
  const r = await fetch(`${c.base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`PayPal auth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  await kv().set(key, j.access_token, Math.max(60, j.expires_in - 120));
  return { c, t: j.access_token };
}

async function call<T>(path: string, init: RequestInit & { idem?: string } = {}): Promise<T> {
  const { c, t } = await token();
  const r = await fetch(`${c.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      ...(init.idem ? { "PayPal-Request-Id": init.idem } : {}),
      Prefer: "return=representation",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as T;
  if (!r.ok) throw new Error(`PayPal ${path} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const amt = (cents: number) => (cents / 100).toFixed(2);

export async function paypalCreate(o: { id: string; code: string; totalCents: number }, returnUrl: string, cancelUrl: string) {
  const j = await call<{ id: string; links: { rel: string; href: string }[] }>("/v2/checkout/orders", {
    method: "POST",
    idem: `create-${o.id}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: o.code, custom_id: o.id, description: `Pedido ${o.code}`, amount: { currency_code: "EUR", value: amt(o.totalCents) } }],
      payment_source: {
        paypal: { experience_context: { brand_name: "Crea tu Burger", locale: "es-ES", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: returnUrl, cancel_url: cancelUrl } },
      },
    }),
  });
  const approve = j.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve) throw new Error("PayPal sin enlace de aprobación");
  return { paypalOrderId: j.id, url: approve.href };
}

type Capture = {
  id: string;
  status: string;
  purchase_units: { custom_id?: string; payments?: { captures?: { id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }[] } }[];
};

export async function paypalCapture(paypalOrderId: string) {
  const j = await call<Capture>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: "POST", idem: `capture-${paypalOrderId}` });
  const cap = j.purchase_units[0]?.payments?.captures?.[0];
  return {
    completed: j.status === "COMPLETED" && cap?.status === "COMPLETED",
    captureId: cap?.id ?? "",
    orderId: cap?.custom_id || j.purchase_units[0]?.custom_id || "",
    amountCents: cap && cap.amount.currency_code === "EUR" ? Math.round(Number(cap.amount.value) * 100) : -1,
    raw: j,
  };
}

export async function paypalRefund(captureId: string, cents: number, orderId: string) {
  const j = await call<{ id: string }>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    idem: `refund-${orderId}-${cents}`,
    body: JSON.stringify({ amount: { value: amt(cents), currency_code: "EUR" } }),
  });
  return j.id;
}

/** Verifica la firma de un webhook con la API de PayPal. */
export async function paypalVerifyWebhook(headers: Headers, body: unknown) {
  const c = await cfg();
  if (!c.webhookId) return false;
  const h = (n: string) => headers.get(n) || "";
  const j = await call<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: c.webhookId,
      webhook_event: body,
    }),
  });
  return j.verification_status === "SUCCESS";
}
