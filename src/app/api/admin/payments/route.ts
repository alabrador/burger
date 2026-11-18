import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json, query } from "@/server/http";
import { paymentConfig } from "@/server/settings";

const q = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), provider: z.enum(["stripe", "paypal", "bizum", "cash", ""]).optional() });

export const GET = admin("payments.view", async (req) => {
  const f = query(req, q);
  const p = schema.payments;
  const where = f.provider ? eq(p.provider, f.provider) : undefined;
  const [rows, [{ total }], cfg, sums] = await Promise.all([
    db()
      .select({ id: p.id, provider: p.provider, providerRef: p.providerRef, status: p.status, amountCents: p.amountCents, refundedCents: p.refundedCents, createdAt: p.createdAt, orderId: p.orderId, code: schema.orders.code, customerName: schema.orders.customerName })
      .from(p)
      .innerJoin(schema.orders, eq(schema.orders.id, p.orderId))
      .where(where)
      .orderBy(desc(p.createdAt))
      .limit(25)
      .offset((f.page - 1) * 25),
    db().select({ total: sql<number>`count(*)::int` }).from(p).where(where),
    paymentConfig(),
    db().execute<{ provider: string; paid: number; refunded: number }>(sql`
      select provider, coalesce(sum(amount_cents) filter (where status in ('paid','refunded','partially_refunded')),0)::int as paid, coalesce(sum(refunded_cents),0)::int as refunded
      from payments where created_at > now() - interval '30 days' group by 1`),
  ]);
  const providers = (["stripe", "paypal", "bizum", "cash"] as const).map((k) => ({ id: k, enabled: cfg[k].enabled, ...([...sums].find((s) => s.provider === k) ?? { paid: 0, refunded: 0 }) }));
  return json({ rows, total, page: f.page, size: 25, providers });
});
