import type Stripe from "stripe";
import { db, schema } from "@/server/db";
import { handle, json } from "@/server/http";
import { markPaid, markPaymentFailed } from "@/server/orders";
import { stripe } from "@/server/payments/stripe";

/** Webhook de Stripe: checkout.session.completed / async_payment_* */
export const POST = handle(async (req) => {
  const { s, webhookSecret } = await stripe();
  if (!webhookSecret) return json({ error: "webhook sin configurar" }, 500);
  const raw = await req.text();
  let ev: Stripe.Event;
  try {
    ev = s.webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", webhookSecret);
  } catch {
    return json({ error: "firma no válida" }, 400);
  }
  const sess = ev.data.object as Stripe.Checkout.Session;
  const orderId = sess.metadata?.orderId;
  if (orderId && (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded")) {
    if (sess.payment_status === "paid") {
      const pi = typeof sess.payment_intent === "string" ? sess.payment_intent : (sess.payment_intent?.id ?? sess.id);
      await markPaid(orderId, "stripe", pi, sess.amount_total ?? -1, { session: sess.id });
    }
  } else if (orderId && ev.type === "checkout.session.async_payment_failed") {
    await markPaymentFailed(orderId, "stripe", sess.id, "Pago asíncrono rechazado");
  }
  await db().insert(schema.webhookEvents).values({ provider: "stripe", eventId: ev.id }).onConflictDoNothing();
  return json({ received: true });
});
