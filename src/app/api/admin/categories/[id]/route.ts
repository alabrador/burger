import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { productId } from "@/server/products";

const patch = z.object({ name: z.string().trim().min(2).max(40), active: z.boolean(), sort: z.number().int().min(0).max(10_000) }).partial();

export const PATCH = admin<RouteContext<"/api/admin/categories/[id]">>("products.edit", async (req, _me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  const b = await body(req, patch, 2048);
  if (b.active === false && (id === "base" || id === "carne")) throw new ApiError(422, "Esta categoría no se puede ocultar", "locked");
  const [c] = await db().update(schema.categories).set({ ...b, updatedAt: sql`now()` }).where(eq(schema.categories.id, id)).returning();
  if (!c) throw new ApiError(404, "Categoría no encontrada", "not_found");
  await invalidateCatalog();
  await log("category.update", "category", id, b);
  return json(c);
});

export const DELETE = admin<RouteContext<"/api/admin/categories/[id]">>("products.edit", async (_req, _me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  const [c] = await db().select().from(schema.categories).where(eq(schema.categories.id, id));
  if (!c) throw new ApiError(404, "Categoría no encontrada", "not_found");
  if (c.locked) throw new ApiError(422, "Esta categoría es fija y no se borra", "locked");
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.products).where(eq(schema.products.category, id));
  if (n) throw new ApiError(422, `Tiene ${n} producto${n > 1 ? "s" : ""}: muévelos o bórralos antes`, "not_empty");
  await db().delete(schema.categories).where(eq(schema.categories.id, id));
  await invalidateCatalog();
  await log("category.delete", "category", id, { name: c.name });
  return json({ ok: true });
});
