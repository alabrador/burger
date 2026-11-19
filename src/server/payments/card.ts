import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { ApiError } from "../http";
import { createOrder, markPaid, quote, resolvePickup, type CreateOrderInput, type Order } from "../orders";
import { getSettings, paymentConfig } from "../settings";
import { stripe, stripeRefund } from "./stripe";
import { reportError } from "../errors";

/**
 * Pago con tarjeta SIN crear el pedido antes de cobrar:
 * 1) prepareCard: valida el pedido, guarda sus datos como borrador y crea el cobro en Stripe.
 * 2) El navegador cobra con el formulario embebido.
 * 3) finalizeCard: comprueba en Stripe que el cobro se completó y solo entonces crea el pedido (ya pagado).
 *    Lo llama el navegador al terminar y, de respaldo, el webhook payment_intent.succeeded.
 */
export async function prepareCard(input: CreateOrderInput, ip: string) {
  const st = await getSettings();
  if (!st.orders.enabled) throw new ApiError(503, st.orders.pausedMessage, "paused");
  const pay = (await paymentConfig()).stripe;
  if (!pay.enabled || !pay.publishableKey) throw new ApiError(422, "El pago con tarjeta no está disponible ahora", "bad_method");
  const q = await quote(input.lines, input.coupon || undefined);
  await resolvePickup(input.pickup);
  const [d] = await db()
    .insert(schema.cardDrafts)
    .values({ payload: { ...input, paymentMethod: "stripe" }, ip, totalCents: q.total })
    .returning({ id: schema.cardDrafts.id });
  const { s } = await stripe();
  const pi = await s.paymentIntents.create(
    {
      amount: q.total,
      currency: "eur",
      allowed_payment_method_types: ["card"], // tarjeta, Apple Pay y Google Pay; sin redirecciones a otras páginas
      receipt_email: input.customer.email,
      description: "Pedido Crea tu Burger",
      metadata: { draft: d.id },
    },
    { idempotencyKey: `draft-${d.id}` },
  );
  await db().update(schema.cardDrafts).set({ paymentIntentId: pi.id }).where(eq(schema.cardDrafts.id, d.id));
  return { draftId: d.id, clientSecret: pi.client_secret!, totalCents: q.total };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function finalizeCard(draftId: string): Promise<Order> {
  const [d] = await db().select().from(schema.cardDrafts).where(eq(schema.cardDrafts.id, draftId));
  if (!d?.paymentIntentId) throw new ApiError(404, "Pago no encontrado", "not_found");
  if (d.orderId) {
    const [o] = await db().select().from(schema.orders).where(eq(schema.orders.id, d.orderId));
    if (o) return o;
  }
  const { s } = await stripe();
  const pi = await s.paymentIntents.retrieve(d.paymentIntentId);
  if (pi.metadata?.draft !== d.id) throw new ApiError(400, "Pago no válido", "bad_payment");
  if (pi.status !== "succeeded") throw new ApiError(402, "El pago todavía no se ha completado", "not_paid");

  const input = d.payload as CreateOrderInput;
  let res: Awaited<ReturnType<typeof createOrder>> | undefined;
  for (let i = 0; i < 4 && !res; i++) {
    try {
      // misma clave de idempotencia: navegador y webhook a la vez crean UN solo pedido
      res = await createOrder(input, d.ip, `card-${d.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "in_progress") {
        await sleep(800);
        continue;
      }
      // Se cobró pero el pedido no se puede crear (franja llena, cupón agotado, tienda en pausa…): devolvemos el dinero.
      try {
        await stripeRefund(pi.id, pi.amount_received, d.id);
      } catch (r) {
        await reportError("payment", r, { path: "reembolso automático", detail: `Cobro ${pi.id} de ${pi.amount_received} céntimos sin pedido y SIN reembolsar. Reembolsar a mano en Stripe.` });
      }
      const msg = e instanceof ApiError ? e.message : "No pudimos registrar el pedido";
      throw new ApiError(409, `${msg} Te hemos devuelto el importe a la tarjeta.`, "refunded");
    }
  }
  if (!res) throw new ApiError(409, "Pedido en proceso, espera un momento", "in_progress");
  await markPaid(res.order.id, "stripe", pi.id, pi.amount_received, { draft: d.id });
  await db().update(schema.cardDrafts).set({ orderId: res.order.id }).where(eq(schema.cardDrafts.id, d.id));
  const [o] = await db().select().from(schema.orders).where(eq(schema.orders.id, res.order.id));
  return o;
}
