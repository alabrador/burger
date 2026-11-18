import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

type C = RouteContext<"/api/admin/customers/[id]">;
const uuid = z.string().uuid();

export const GET = admin<C>("customers.view", async (_req, _me, _log, ctx) => {
  const id = uuid.parse((await ctx.params).id);
  const [c] = await db().select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!c) throw new ApiError(404, "Cliente no encontrado", "not_found");
  const orders = await db()
    .select({ id: schema.orders.id, code: schema.orders.code, status: schema.orders.status, totalCents: schema.orders.totalCents, createdAt: schema.orders.createdAt, paymentMethod: schema.orders.paymentMethod })
    .from(schema.orders)
    .where(eq(schema.orders.customerId, id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
  return json({ customer: c, orders });
});

export const PATCH = admin<C>("customers.view", async (req, _me, log, ctx) => {
  const id = uuid.parse((await ctx.params).id);
  const b = await body(req, z.object({ notes: z.string().trim().max(500).nullable() }), 2048);
  await db().update(schema.customers).set({ notes: b.notes }).where(eq(schema.customers.id, id));
  await log("customer.notes", "customer", id);
  return json({ ok: true });
});

/** Derecho de supresión (RGPD): anonimiza al cliente y sus pedidos, conservando los importes para contabilidad. */
export const DELETE = admin<C>("customers.delete", async (_req, _me, log, ctx) => {
  const id = uuid.parse((await ctx.params).id);
  const anon = `anon-${id.slice(0, 8)}@anonimo.invalid`;
  await db().transaction(async (tx) => {
    const [c] = await tx
      .update(schema.customers)
      .set({ email: anon, name: "Cliente anonimizado", phone: null, notes: null, marketingOptIn: false, anonymizedAt: sql`now()` })
      .where(eq(schema.customers.id, id))
      .returning();
    if (!c) throw new ApiError(404, "Cliente no encontrado", "not_found");
    await tx.update(schema.orders).set({ customerName: "Anónimo", customerEmail: anon, customerPhone: null, ip: null, notes: null }).where(eq(schema.orders.customerId, id));
    await tx.delete(schema.emailOutbox).where(sql`${schema.emailOutbox.orderId} in (select id from orders where customer_id = ${id})`);
  });
  await log("customer.anonymize", "customer", id);
  return json({ ok: true });
});
