import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { productFields, productId } from "@/server/products";

const patch = z.object(productFields).partial();

/** Cocina y caja pueden marcar agotado; el resto de campos requiere products.edit. */
export const PATCH = admin<RouteContext<"/api/admin/products/[id]">>("orders.update", async (req, me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  const b = await body(req, patch, 8192);
  const onlyStock = Object.keys(b).every((k) => k === "soldOut");
  if (!onlyStock && !["owner", "admin", "manager"].includes(me.role)) throw new ApiError(403, "No tienes permiso para editar productos", "forbidden");
  if (id === "burger" && (b.active === false || b.soldOut === true)) throw new ApiError(422, "La base no se puede desactivar; pausa los pedidos en Configuración", "base");
  const [before] = await db().select().from(schema.products).where(eq(schema.products.id, id));
  if (!before) throw new ApiError(404, "Producto no encontrado", "not_found");
  if (b.category && b.category !== before.category) {
    if (before.kind !== "ingredient") throw new ApiError(422, "Solo los ingredientes cambian de categoría", "bad_category");
    const [cat] = await db().select().from(schema.categories).where(eq(schema.categories.id, b.category));
    if (!cat || cat.id === "base" || cat.id === "bebidas") throw new ApiError(422, "Categoría no válida para un ingrediente", "bad_category");
  }
  const [p] = await db().update(schema.products).set({ ...b, updatedAt: sql`now()` }).where(eq(schema.products.id, id)).returning();
  await invalidateCatalog();
  const changed = Object.fromEntries(Object.keys(b).map((k) => [k, { from: before[k as keyof typeof before], to: p[k as keyof typeof p] }]));
  await log("product.update", "product", id, changed);
  return json(p);
});

/** Solo se borran los creados en el admin; los de la carta base se ocultan. */
export const DELETE = admin<RouteContext<"/api/admin/products/[id]">>("products.edit", async (_req, _me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  const [p] = await db().select().from(schema.products).where(eq(schema.products.id, id));
  if (!p) throw new ApiError(404, "Producto no encontrado", "not_found");
  if (!p.custom) throw new ApiError(422, "Los productos de la carta base no se borran: desactívalos", "not_custom");
  await db().delete(schema.products).where(eq(schema.products.id, id));
  await invalidateCatalog();
  await log("product.delete", "product", id, { name: p.name });
  return json({ ok: true });
});
