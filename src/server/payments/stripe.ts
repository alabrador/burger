import "server-only";
import Stripe from "stripe";
import { paymentConfig } from "../settings";

let cache: { key: string; s: Stripe } | null = null;
export async function stripe() {
  const c = (await paymentConfig()).stripe;
  if (!c.secretKey) throw new Error("Stripe no configurado");
  if (cache?.key !== c.secretKey) cache = {
      key: c.secretKey,
      s: new Stripe(c.secretKey, {
        maxNetworkRetries: 2,
        timeout: 15_000,
        // solo pruebas locales contra un Stripe simulado: STRIPE_API_HOST=localhost:12111 y STRIPE_API_HOST_TEST=1
        ...(process.env.STRIPE_API_HOST && process.env.STRIPE_API_HOST_TEST === "1"
          ? { host: process.env.STRIPE_API_HOST!.split(":")[0], port: Number(process.env.STRIPE_API_HOST!.split(":")[1] || 80), protocol: "http" as const }
          : {}),
      }),
    };
  return { s: cache.s, webhookSecret: c.webhookSecret };
}

export async function stripeCheckout(o: { id: string; code: string; totalCents: number; customerEmail: string }, okUrl: string, koUrl: string) {
  const { s } = await stripe();
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      currency: "eur",
      customer_email: o.customerEmail,
      client_reference_id: o.id,
      metadata: { orderId: o.id, code: o.code },
      payment_intent_data: { metadata: { orderId: o.id, code: o.code }, description: `Pedido ${o.code}` },
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.totalCents, product_data: { name: `Pedido ${o.code} · Crea tu Burger` } } }],
      success_url: okUrl,
      cancel_url: koUrl,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      locale: "es",
    },
    { idempotencyKey: `checkout-${o.id}-${Math.floor(Date.now() / 600_000)}` },
  );
  return session.url!;
}

export async function stripeRefund(paymentIntent: string, amountCents: number, orderId: string) {
  const { s } = await stripe();
  const r = await s.refunds.create({ payment_intent: paymentIntent, amount: amountCents }, { idempotencyKey: `refund-${orderId}-${amountCents}` });
  return r.id;
}

/**
 * Comprobación de respaldo por si el webhook no llega (mal configurado, caído, etc.):
 * busca en Stripe un cobro completado de este pedido y lo marca como pagado.
 */
export async function stripeFindPaid(orderId: string) {
  const { s } = await stripe();
  const r = await s.paymentIntents.search({ query: `metadata['orderId']:'${orderId}' AND status:'succeeded'`, limit: 1 });
  const pi = r.data[0];
  return pi ? { ref: pi.id, amountCents: pi.amount_received } : null;
}

/** Cobro para el formulario de tarjeta embebido (Payment Element): devuelve el client_secret. */
export async function stripeIntent(o: { id: string; code: string; totalCents: number; customerEmail: string }) {
  const { s } = await stripe();
  const pi = await s.paymentIntents.create(
    {
      amount: o.totalCents,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      receipt_email: o.customerEmail || undefined,
      description: `Pedido ${o.code} · Crea tu Burger`,
      metadata: { orderId: o.id, code: o.code },
    },
    // mismo pedido + mismo importe = mismo cobro (reintentos y dobles clics no duplican)
    { idempotencyKey: `pi-${o.id}-${o.totalCents}` },
  );
  return pi.client_secret!;
}
