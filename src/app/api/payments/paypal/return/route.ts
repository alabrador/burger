import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { handle, limit } from "@/server/http";
import { markPaid } from "@/server/orders";
import { paypalCapture } from "@/server/payments/paypal";
import { checkTrackToken, trackToken } from "@/server/tokens";

/** El cliente vuelve de PayPal: capturamos el pago y lo mandamos al seguimiento. */
export const GET = handle(async (req) => {
  await limit(req, "paypal-return", 20, 60);
  const sp = req.nextUrl.searchParams;
  const orderId = sp.get("o") || "";
  const ppOrder = sp.get("token") || "";
  const [o] = /^[0-9a-f-]{36}$/.test(orderId) ? await db().select().from(schema.orders).where(eq(schema.orders.id, orderId)) : [];
  if (!o || !checkTrackToken(o.code, sp.get("t") || "")) return NextResponse.redirect(`${env.baseUrl}/`);
  const go = (pago: string) => NextResponse.redirect(`${env.baseUrl}/pedido?c=${o.code}&t=${trackToken(o.code)}&pago=${pago}`, 303);
  if (o.paymentStatus === "paid") return go("ok");
  // El id de PayPal debe ser uno que creamos nosotros para este pedido.
  const [p] = await db()
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, o.id), eq(schema.payments.provider, "paypal"), eq(schema.payments.providerRef, ppOrder)));
  if (!p) return go("ko");
  try {
    const c = await paypalCapture(ppOrder);
    if (!c.completed || c.orderId !== o.id) return go("ko");
    // Guardamos la captura (necesaria para reembolsar) en lugar del id de orden.
    await db().update(schema.payments).set({ providerRef: c.captureId }).where(eq(schema.payments.id, p.id)).catch(() => {});
    await markPaid(o.id, "paypal", c.captureId, c.amountCents, { paypalOrder: ppOrder });
    return go("ok");
  } catch (e) {
    console.error("[paypal]", e);
    return go("ko");
  }
});
