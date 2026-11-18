import { asc, inArray, sql } from "drizzle-orm";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json } from "@/server/http";
import { boardVersion } from "@/server/kds";
import { maintenance } from "@/server/orders";

/** Tablero de cocina. Si la versión no cambió responde vacío (polling barato). */
export const GET = admin("orders.view", async (req) => {
  await maintenance();
  const v = await boardVersion();
  if (Number(req.nextUrl.searchParams.get("v")) === v && v > 0) return json({ v, changed: false });
  const o = schema.orders;
  const orders = await db()
    .select({ id: o.id, code: o.code, status: o.status, customerName: o.customerName, pickupAt: o.pickupAt, createdAt: o.createdAt, paidAt: o.paidAt, notes: o.notes, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, totalCents: o.totalCents })
    .from(o)
    .where(sql`${o.status} in ('confirmed','preparing','ready') or (${o.status} = 'collected' and ${o.collectedAt} > now() - interval '15 minutes')`)
    .orderBy(asc(o.pickupAt))
    .limit(200);
  const items = orders.length
    ? await db().select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((x) => x.id)))
    : [];
  return json({ v, changed: true, orders: orders.map((x) => ({ ...x, items: items.filter((i) => i.orderId === x.id).map(({ orderId: _o, ...i }) => i) })) });
});
