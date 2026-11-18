import { eq } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { can } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { setStatus } from "@/server/orders";
import { qrPayload } from "@/server/tokens";

type C = RouteContext<"/api/admin/orders/[id]">;
const uuid = z.string().uuid();

export const GET = admin<C>("orders.view", async (_req, me, _log, ctx) => {
  const id = uuid.parse((await ctx.params).id);
  const [o] = await db().select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o) throw new ApiError(404, "Pedido no encontrado", "not_found");
  const [items, events, payments] = await Promise.all([
    db().select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)),
    db().select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id)).orderBy(schema.orderEvents.createdAt),
    can(me.role, "payments.view") ? db().select().from(schema.payments).where(eq(schema.payments.orderId, id)) : Promise.resolve([]),
  ]);
  return json({ order: o, items, events, payments: payments.map(({ raw: _r, ...p }) => p), qr: qrPayload(o.code) });
});

const patch = z.object({
  status: z.enum(["confirmed", "preparing", "ready", "collected", "cancelled"]).optional(),
  reason: z.string().trim().max(300).optional(),
  cashPaid: z.boolean().optional(),
  notify: z.boolean().optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const PATCH = admin<C>("orders.update", async (req, me, log, ctx) => {
  const id = uuid.parse((await ctx.params).id);
  const b = await body(req, patch, 4096);
  if (b.status === "cancelled" && me.role === "kitchen") throw new ApiError(403, "Cocina no puede cancelar pedidos", "forbidden");
  if (b.note) {
    await db().insert(schema.orderEvents).values({ orderId: id, type: "note", message: b.note, userId: me.id });
    await log("order.note", "order", id);
  }
  if (b.status) {
    const o = await setStatus(id, b.status, me, { reason: b.reason, cashPaid: b.cashPaid, notify: b.notify });
    await log(`order.${b.status}`, "order", id, { code: o.code, reason: b.reason });
    return json({ ok: true, status: o.status });
  }
  return json({ ok: true });
});
