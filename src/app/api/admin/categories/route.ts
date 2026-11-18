import { sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { slugify } from "@/server/products";

export const GET = admin("orders.view", async () =>
  json(
    await db()
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        sort: schema.categories.sort,
        active: schema.categories.active,
        locked: schema.categories.locked,
        products: sql<number>`(select count(*)::int from products p where p.category = categories.id)`,
      })
      .from(schema.categories)
      .orderBy(schema.categories.sort),
  ),
);

export const POST = admin("products.edit", async (req, _me, log) => {
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(40) }), 2048);
  const id = slugify(b.name);
  const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${schema.categories.sort}), 0)::int` }).from(schema.categories);
  const [c] = await db()
    .insert(schema.categories)
    .values({ id, name: b.name, sort: max + 1 })
    .onConflictDoNothing()
    .returning();
  if (!c) throw new ApiError(409, "Ya existe una categoría con ese nombre", "exists");
  await invalidateCatalog();
  await log("category.create", "category", id, { name: b.name });
  return json({ ...c, products: 0 }, 201);
});
