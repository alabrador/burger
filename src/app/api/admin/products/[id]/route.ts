import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";

const ALLERGENS = ["gluten", "crustáceos", "huevo", "pescado", "cacahuetes", "soja", "leche", "frutos de cáscara", "apio", "mostaza", "sésamo", "sulfitos", "altramuces", "moluscos"] as const;
const patch = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(160).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000).optional(),
  grams: z.number().int().min(0).max(5000).optional(),
  kcal: z.number().int().min(0).max(5000).optional(),
  maxQty: z.number().int().min(1).max(5).optional(),
  allergens: z.array(z.enum(ALLERGENS)).max(14).optional(),
  active: z.boolean().optional(),
  soldOut: z.boolean().optional(),
});

/** Cocina y caja pueden marcar agotado; el resto de campos requiere products.edit. */
export const PATCH = admin<RouteContext<"/api/admin/products/[id]">>("orders.update", async (req, me, log, ctx) => {
  const id = z.string().regex(/^[a-z0-9_]{1,32}$/).parse((await ctx.params).id);
  const b = await body(req, patch, 4096);
  const onlyStock = Object.keys(b).every((k) => k === "soldOut");
  if (!onlyStock && !["owner", "admin", "manager"].includes(me.role)) throw new ApiError(403, "No tienes permiso para editar productos", "forbidden");
  if (id === "burger" && (b.active === false || b.soldOut === true)) throw new ApiError(422, "La base no se puede desactivar; pausa los pedidos en Configuración", "base");
  const [before] = await db().select().from(schema.products).where(eq(schema.products.id, id));
  if (!before) throw new ApiError(404, "Producto no encontrado", "not_found");
  const [p] = await db().update(schema.products).set({ ...b, updatedAt: sql`now()` }).where(eq(schema.products.id, id)).returning();
  await invalidateCatalog();
  const changed = Object.fromEntries(Object.keys(b).map((k) => [k, { from: before[k as keyof typeof before], to: p[k as keyof typeof p] }]));
  await log("product.update", "product", id, changed);
  return json(p);
});
