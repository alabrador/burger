import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import { bumpBoard } from "../kds";
import { enqueue } from "../mail/outbox";
import { flushMail, mailOrder, setStatus, type Order } from "../orders";
import { paymentConfig } from "../settings";
import { trackToken } from "../tokens";
import { paypalCreate, paypalRefund } from "./paypal";
import { redsysForm, redsysOrderNumber, redsysRefund } from "./redsys";
import { stripeCheckout, stripeIntent, stripeRefund } from "./stripe";

export type PaymentStart =
  | { type: "none" }
  | { type: "redirect"; url: string }
  | { type: "form"; url: string; fields: Record<string, string> }
  | { type: "stripe"; clientSecret: string; publishableKey: string; returnUrl: string; amountCents: number };

const pageUrl = (o: Order, pago: string) => `${env.baseUrl}/pedido?c=${o.code}&t=${trackToken(o.code)}&pago=${pago}`;

/** Inicia el pago online del pedido y devuelve a dónde mandar al cliente. */
export async function startPayment(o: Order): Promise<PaymentStart> {
  if (o.paymentMethod === "cash" || o.paymentStatus === "paid") return { type: "none" };
  const ok = pageUrl(o, "ok");
  const ko = pageUrl(o, "ko");
  if (o.paymentMethod === "stripe") {
    // Con clave pública: formulario de tarjeta dentro de la web. Sin ella: página de pago de Stripe.
    const pk = (await paymentConfig()).stripe.publishableKey;
    if (pk) return { type: "stripe", clientSecret: await stripeIntent(o), publishableKey: pk, returnUrl: ok, amountCents: o.totalCents };
    return { type: "redirect", url: await stripeCheckout(o, ok, ko) };
  }
  if (o.paymentMethod === "paypal") {
    const r = await paypalCreate(o, `${env.baseUrl}/api/payments/paypal/return?o=${o.id}&t=${trackToken(o.code)}`, ko);
    await db()
      .insert(schema.payments)
      .values({ orderId: o.id, provider: "paypal", providerRef: r.paypalOrderId, status: "pending", amountCents: o.totalCents })
      .onConflictDoNothing();
    return { type: "redirect", url: r.url };
  }
  const c = (await paymentConfig()).bizum;
  const order = redsysOrderNumber();
  await db().insert(schema.payments).values({ orderId: o.id, provider: "bizum", providerRef: order, status: "pending", amountCents: o.totalCents });
  return {
    type: "form",
    ...redsysForm(c, {
      order,
      amountCents: o.totalCents,
      notifyUrl: `${env.baseUrl}/api/payments/redsys/notify`,
      okUrl: ok,
      koUrl: ko,
      description: `Pedido ${o.code}`,
    }),
  };
}

/** Reembolso total o parcial desde el admin. */
export async function refund(orderId: string, amountCents: number | null, by: { id: string; email: string }) {
  const [o] = await db().select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!o) throw new ApiError(404, "Pedido no encontrado", "not_found");
  const [p] = await db()
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "paid")))
    .limit(1);
  const [pr] = p ? [p] : await db().select().from(schema.payments).where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, "partially_refunded"))).limit(1);
  if (!pr) throw new ApiError(409, "Este pedido no tiene un pago que reembolsar", "no_payment");
  const left = pr.amountCents - pr.refundedCents;
  const amount = amountCents ?? left;
  if (amount <= 0 || amount > left) throw new ApiError(422, `Se puede reembolsar como máximo ${(left / 100).toFixed(2)} €`, "bad_amount");

  let ref = `manual-${Date.now()}`;
  const ptype = pr.provider;
  if (ptype === "stripe") ref = await stripeRefund(pr.providerRef!, amount, orderId);
  else if (ptype === "paypal") ref = await paypalRefund(pr.providerRef!, amount, orderId);
  else if (ptype === "bizum") ref = await redsysRefund((await paymentConfig()).bizum, pr.providerRef!, amount);
  // efectivo: se devuelve en mano y solo se registra

  const full = amount === left;
  await db().transaction(async (tx) => {
    await tx
      .update(schema.payments)
      .set({ refundedCents: sql`${schema.payments.refundedCents} + ${amount}`, status: full ? "refunded" : "partially_refunded", updatedAt: sql`now()` })
      .where(eq(schema.payments.id, pr.id));
    const [u] = await tx
      .update(schema.orders)
      .set({ paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: sql`now()` })
      .where(eq(schema.orders.id, orderId))
      .returning();
    if (o.customerId)
      await tx
        .update(schema.customers)
        .set({ totalSpentCents: sql`greatest(${schema.customers.totalSpentCents} - ${amount}, 0)` })
        .where(eq(schema.customers.id, o.customerId));
    await tx.insert(schema.orderEvents).values({ orderId, type: "payment:refunded", message: `Reembolso de ${(amount / 100).toFixed(2)} € (${ref})`, userId: by.id });
    await enqueue(tx, "refunded", o.customerEmail, mailOrder({ ...u, totalCents: amount }, []));
  });
  if (full && !["collected", "cancelled"].includes(o.status)) await setStatus(orderId, "cancelled", by, { reason: "Reembolsado", notify: false });
  bumpBoard();
  flushMail(orderId);
  return { amount, ref };
}
