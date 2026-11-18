import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { ApiError, handle, json, limit } from "@/server/http";
import { startPayment } from "@/server/payments";
import { checkTrackToken } from "@/server/tokens";

/** Reintentar el pago de un pedido que sigue pendiente (p. ej. tras cancelar en la pasarela). */
export const POST = handle<RouteContext<"/api/orders/[code]/pay">>(async (req, ctx) => {
  await limit(req, "pay-retry", 6, 60);
  const { code } = await ctx.params;
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!checkTrackToken(code, t)) throw new ApiError(404, "Pedido no encontrado", "not_found");
  const [o] = await db().select().from(schema.orders).where(eq(schema.orders.code, code));
  if (!o) throw new ApiError(404, "Pedido no encontrado", "not_found");
  if (o.status !== "pending_payment") throw new ApiError(409, "Este pedido ya no está pendiente de pago", "not_pending");
  return json({ payment: await startPayment(o) });
});
