import "server-only";
import { and, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { schema } from "./db";

export const listSchema = z.object({
  status: z.enum(["pending_payment", "confirmed", "preparing", "ready", "collected", "cancelled", "active", ""]).optional(),
  method: z.enum(["stripe", "paypal", "bizum", "cash", ""]).optional(),
  q: z.string().trim().max(80).optional(),
  from: z.string().date().optional().or(z.literal("")),
  to: z.string().date().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  size: z.coerce.number().int().min(10).max(100).default(25),
});

export function orderFilters(f: z.infer<typeof listSchema>) {
  const o = schema.orders;
  const w: (SQL | undefined)[] = [];
  if (f.status === "active") w.push(sql`${o.status} in ('confirmed','preparing','ready')`);
  else if (f.status) w.push(eq(o.status, f.status));
  if (f.method) w.push(eq(o.paymentMethod, f.method));
  if (f.from) w.push(gte(o.createdAt, new Date(`${f.from}T00:00:00`)));
  if (f.to) w.push(lte(o.createdAt, new Date(`${f.to}T23:59:59.999`)));
  if (f.q) {
    const q = f.q.replace(/[%_\\]/g, "");
    w.push(or(eq(o.code, q.toUpperCase()), ilike(o.customerName, `%${q}%`), ilike(o.customerEmail, `%${q}%`), ilike(o.customerPhone, `%${q}%`)));
  }
  return and(...w);
}
