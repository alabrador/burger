import { desc, eq, inArray } from "drizzle-orm";
import { getCustomer } from "@/server/customer-auth";
import { db, schema } from "@/server/db";
import { handle, json } from "@/server/http";
import { trackToken } from "@/server/tokens";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Cuenta del cliente con sus últimos pedidos (para "Repetir"). */
export const GET = handle(async (req) => {
  const c = await getCustomer(req);
  if (!c) return json({ customer: null }, { headers: NO_STORE });
  const orders = await db()
    .select({
      id: schema.orders.id,
      code: schema.orders.code,
      status: schema.orders.status,
      totalCents: schema.orders.totalCents,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.customerId, c.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(20);
  const items = orders.length
    ? await db()
        .select({ orderId: schema.orderItems.orderId, quantity: schema.orderItems.quantity, title: schema.orderItems.title, description: schema.orderItems.description, config: schema.orderItems.config })
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)))
    : [];
  return json(
    {
      customer: { name: c.name, email: c.email, phone: c.phone },
      orders: orders
        .filter((o) => o.status !== "pending_payment")
        .map((o) => ({
          code: o.code,
          status: o.status,
          totalCents: o.totalCents,
          createdAt: o.createdAt,
          url: `/pedido?c=${o.code}&t=${trackToken(o.code)}`,
          items: items.filter((i) => i.orderId === o.id).map((i) => ({ quantity: i.quantity, title: i.title, description: i.description, config: i.config })),
        })),
    },
    { headers: NO_STORE },
  );
});
