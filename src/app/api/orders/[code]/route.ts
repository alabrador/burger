import { ApiError, handle, json, limit } from "@/server/http";
import { getOrderByCode, markPaid } from "@/server/orders";
import { stripeFindPaid } from "@/server/payments/stripe";
import { kv } from "@/server/redis";
import { getSettings } from "@/server/settings";
import { checkTrackToken, qrPayload } from "@/server/tokens";

/** Seguimiento público del pedido (requiere el token firmado del enlace). */
export const GET = handle<RouteContext<"/api/orders/[code]">>(async (req, ctx) => {
  await limit(req, "track", 120, 60);
  const { code } = await ctx.params;
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!/^[A-Z0-9]{4,12}$/.test(code) || !checkTrackToken(code, t)) throw new ApiError(404, "Pedido no encontrado", "not_found");
  let r = await getOrderByCode(code);
  if (!r) throw new ApiError(404, "Pedido no encontrado", "not_found");
  // Respaldo del webhook: si el pago con tarjeta sigue pendiente, se pregunta a Stripe (como mucho cada 8 s).
  if (r.order.paymentMethod === "stripe" && r.order.paymentStatus === "pending" && (await kv().setNx(`stripe:check:${r.order.id}`, "1", 8))) {
    try {
      const paid = await stripeFindPaid(r.order.id);
      if (paid) {
        await markPaid(r.order.id, "stripe", paid.ref, paid.amountCents, { via: "consulta" });
        r = (await getOrderByCode(code)) ?? r;
      }
    } catch (e) {
      console.error("[stripe] comprobación de respaldo", e);
    }
  }
  const { order: o, items, events } = r;
  const st = (await getSettings()).store;
  return json({
    code: o.code,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    customerName: o.customerName.split(" ")[0],
    pickupAt: o.pickupAt,
    createdAt: o.createdAt,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    totalCents: o.totalCents,
    taxCents: o.taxCents,
    items: items.map((i) => ({ title: i.title, description: i.description, quantity: i.quantity, totalCents: i.totalCents })),
    timeline: events.filter((e) => e.type.startsWith("status:") || e.type === "created" || e.type === "payment:paid").map((e) => ({ type: e.type, at: e.createdAt })),
    qr: ["confirmed", "preparing", "ready"].includes(o.status) ? qrPayload(o.code) : null,
    store: { name: st.name, address: [st.address, st.city].filter(Boolean).join(", "), phone: st.phone },
  });
});
