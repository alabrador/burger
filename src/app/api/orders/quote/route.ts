import { z } from "zod";
import { body, handle, json, limit } from "@/server/http";
import { lineSchema, quote } from "@/server/orders";

const schema = z.object({ lines: z.array(lineSchema).min(1).max(10), coupon: z.string().trim().toUpperCase().max(32).regex(/^[A-Z0-9_-]*$/).optional() });

export const POST = handle(async (req) => {
  await limit(req, "quote", 60, 60);
  const b = await body(req, schema);
  const q = await quote(b.lines, b.coupon || undefined);
  return json({ subtotalCents: q.subtotal, discountCents: q.discount, totalCents: q.total, taxCents: q.tax, lines: q.priced.map((l) => ({ title: l.title, description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents })) });
});
