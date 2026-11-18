import { eq } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

type C = RouteContext<"/api/admin/coupons/[code]">;
const code = z.string().regex(/^[A-Z0-9_-]{3,32}$/);
const patch = z.object({
  active: z.boolean().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  validTo: z.string().datetime({ offset: true }).nullable().optional(),
});

export const PATCH = admin<C>("coupons.edit", async (req, _me, log, ctx) => {
  const c = code.parse((await ctx.params).code);
  const b = await body(req, patch, 1024);
  const [r] = await db()
    .update(schema.coupons)
    .set({ ...b, validTo: b.validTo === undefined ? undefined : b.validTo ? new Date(b.validTo) : null })
    .where(eq(schema.coupons.code, c))
    .returning();
  if (!r) throw new ApiError(404, "Cupón no encontrado", "not_found");
  await log("coupon.update", "coupon", c, b);
  return json(r);
});

export const DELETE = admin<C>("coupons.edit", async (_req, _me, log, ctx) => {
  const c = code.parse((await ctx.params).code);
  // Si ya se usó, solo se desactiva para no perder el historial.
  const [r] = await db().select().from(schema.coupons).where(eq(schema.coupons.code, c));
  if (!r) throw new ApiError(404, "Cupón no encontrado", "not_found");
  if (r.usedCount > 0) await db().update(schema.coupons).set({ active: false }).where(eq(schema.coupons.code, c));
  else await db().delete(schema.coupons).where(eq(schema.coupons.code, c));
  await log("coupon.delete", "coupon", c);
  return json({ ok: true, deactivated: r.usedCount > 0 });
});
