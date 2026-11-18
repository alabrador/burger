import { desc, sql } from "drizzle-orm";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json, query } from "@/server/http";
import { listSchema, orderFilters } from "@/server/order-filters";

export const GET = admin("orders.view", async (req) => {
  const f = query(req, listSchema);
  const where = orderFilters(f);
  const o = schema.orders;
  const [rows, [{ total }]] = await Promise.all([
    db()
      .select({
        id: o.id, code: o.code, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod,
        customerName: o.customerName, customerEmail: o.customerEmail, totalCents: o.totalCents, pickupAt: o.pickupAt, createdAt: o.createdAt,
        items: sql<number>`(select coalesce(sum(quantity),0)::int from order_items i where i.order_id = orders.id)`,
      })
      .from(o)
      .where(where)
      .orderBy(desc(o.createdAt))
      .limit(f.size)
      .offset((f.page - 1) * f.size),
    db().select({ total: sql<number>`count(*)::int` }).from(o).where(where),
  ]);
  return json({ rows, total, page: f.page, size: f.size });
});
