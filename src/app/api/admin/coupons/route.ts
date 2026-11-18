import { desc } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3 a 32 letras, números, - o _"),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().positive(),
    minTotalCents: z.number().int().min(0).max(1_000_000).default(0),
    maxUses: z.number().int().positive().max(1_000_000).nullable().default(null),
    validFrom: z.string().datetime({ offset: true }).nullable().default(null),
    validTo: z.string().datetime({ offset: true }).nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((c) => c.type !== "percent" || c.value <= 100, { message: "Máximo 100 %", path: ["value"] });

export const GET = admin("coupons.edit", async () => json(await db().select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt))));

export const POST = admin("coupons.edit", async (req, _me, log) => {
  const b = await body(req, couponSchema, 2048);
  const rows = await db()
    .insert(schema.coupons)
    .values({ ...b, validFrom: b.validFrom ? new Date(b.validFrom) : null, validTo: b.validTo ? new Date(b.validTo) : null })
    .onConflictDoNothing()
    .returning();
  if (!rows.length) throw new ApiError(409, "Ya existe un cupón con ese código", "exists");
  await log("coupon.create", "coupon", b.code, b);
  return json(rows[0], 201);
});
