import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { productFields, slugify } from "@/server/products";

export const GET = admin("orders.view", async () => json(await db().select().from(schema.products).orderBy(asc(schema.products.sort))));

const create = z.object({
  ...productFields,
  description: productFields.description.optional(),
  grams: productFields.grams.default(0),
  kcal: productFields.kcal.default(0),
  maxQty: productFields.maxQty.default(1),
  allergens: productFields.allergens.default([]),
  active: productFields.active.default(true),
  model: productFields.model.default(null),
  swatch: productFields.swatch.default("#c9792e"),
});

/** Nuevo ingrediente en una categoría (no en base ni bebidas). */
export const POST = admin("products.edit", async (req, _me, log) => {
  const b = await body(req, create.omit({ soldOut: true, sort: true }), 8192);
  const [cat] = await db().select().from(schema.categories).where(eq(schema.categories.id, b.category));
  if (!cat) throw new ApiError(422, "La categoría no existe", "bad_category");
  if (cat.id === "base" || cat.id === "bebidas") throw new ApiError(422, "En esta categoría no se pueden añadir ingredientes", "bad_category");
  const base = slugify(b.name);
  const taken = new Set((await db().select({ id: schema.products.id }).from(schema.products).where(sql`${schema.products.id} like ${base + "%"}`)).map((r) => r.id));
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}_${i}`;
  const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${schema.products.sort}), 0)::int` }).from(schema.products);
  const [p] = await db()
    .insert(schema.products)
    .values({ ...b, id, kind: "ingredient", description: b.description ?? null, sort: max + 1, custom: true })
    .returning();
  await invalidateCatalog();
  await log("product.create", "product", id, { name: p.name, category: p.category, priceCents: p.priceCents });
  return json(p, 201);
});
