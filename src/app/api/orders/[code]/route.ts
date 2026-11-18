import { ApiError, handle, json, limit } from "@/server/http";
import { getOrderByCode } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { checkTrackToken, qrPayload } from "@/server/tokens";

/** Seguimiento público del pedido (requiere el token firmado del enlace). */
export const GET = handle<RouteContext<"/api/orders/[code]">>(async (req, ctx) => {
  await limit(req, "track", 120, 60);
  const { code } = await ctx.params;
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!/^[A-Z0-9]{4,12}$/.test(code) || !checkTrackToken(code, t)) throw new ApiError(404, "Pedido no encontrado", "not_found");
  const r = await getOrderByCode(code);
  if (!r) throw new ApiError(404, "Pedido no encontrado", "not_found");
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
