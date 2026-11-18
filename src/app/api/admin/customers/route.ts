import { desc, ilike, isNull, or, sql, and } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { json, query } from "@/server/http";

const q = z.object({
  q: z.string().trim().max(80).optional(),
  sort: z.enum(["recent", "orders", "spent"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const GET = admin("customers.view", async (req) => {
  const f = query(req, q);
  const c = schema.customers;
  const s = f.q?.replace(/[%_\\]/g, "");
  const where = and(isNull(c.anonymizedAt), s ? or(ilike(c.name, `%${s}%`), ilike(c.email, `%${s}%`), ilike(c.phone, `%${s}%`)) : undefined);
  const order = f.sort === "orders" ? desc(c.ordersCount) : f.sort === "spent" ? desc(c.totalSpentCents) : sql`${c.lastOrderAt} desc nulls last`;
  const [rows, [{ total }]] = await Promise.all([
    db().select().from(c).where(where).orderBy(order).limit(25).offset((f.page - 1) * 25),
    db().select({ total: sql<number>`count(*)::int` }).from(c).where(where),
  ]);
  return json({ rows, total, page: f.page, size: 25 });
});
