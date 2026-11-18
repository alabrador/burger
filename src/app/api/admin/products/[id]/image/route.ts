import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { invalidateCatalog } from "@/server/catalog";
import { db, schema } from "@/server/db";
import { ApiError, body, json } from "@/server/http";
import { decodeImage, productId } from "@/server/products";

const MAX = 400 * 1024;

/** Sube la foto (el navegador ya la reduce a 512 px en WebP). */
export const PUT = admin<RouteContext<"/api/admin/products/[id]/image">>("products.edit", async (req, _me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  const b = await body(req, z.object({ data: z.string().max(Math.ceil((MAX * 4) / 3) + 64) }), Math.ceil((MAX * 4) / 3) + 1024);
  const img = decodeImage(b.data);
  if (!img) throw new ApiError(422, "Formato de imagen no válido (usa JPG, PNG o WebP)", "bad_image");
  if (img.data.length > MAX) throw new ApiError(413, "La imagen pesa demasiado", "too_large");
  const p = await db().transaction(async (tx) => {
    const [p] = await tx.update(schema.products).set({ imageV: sql`${schema.products.imageV} + 1`, updatedAt: sql`now()` }).where(eq(schema.products.id, id)).returning();
    if (!p) throw new ApiError(404, "Producto no encontrado", "not_found");
    await tx
      .insert(schema.productImages)
      .values({ productId: id, type: img.type, data: img.data })
      .onConflictDoUpdate({ target: schema.productImages.productId, set: { type: img.type, data: img.data, updatedAt: sql`now()` } });
    return p;
  });
  await invalidateCatalog();
  await log("product.image", "product", id, { bytes: img.data.length });
  return json(p);
});

export const DELETE = admin<RouteContext<"/api/admin/products/[id]/image">>("products.edit", async (_req, _me, log, ctx) => {
  const id = productId.parse((await ctx.params).id);
  await db().delete(schema.productImages).where(eq(schema.productImages.productId, id));
  const [p] = await db().update(schema.products).set({ imageV: 0, updatedAt: sql`now()` }).where(eq(schema.products.id, id)).returning();
  if (!p) throw new ApiError(404, "Producto no encontrado", "not_found");
  await invalidateCatalog();
  await log("product.image_delete", "product", id);
  return json(p);
});
