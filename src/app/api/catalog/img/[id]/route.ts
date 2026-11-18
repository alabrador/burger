import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { ApiError, handle } from "@/server/http";
import { productId } from "@/server/products";

/** Foto pública de un producto. La URL lleva ?v=N, así que se cachea un año. */
export const GET = handle<RouteContext<"/api/catalog/img/[id]">>(async (_req, ctx) => {
  const id = productId.safeParse((await ctx.params).id);
  if (!id.success) throw new ApiError(404, "No encontrada", "not_found");
  const [img] = await db().select().from(schema.productImages).where(eq(schema.productImages.productId, id.data));
  if (!img) throw new ApiError(404, "No encontrada", "not_found");
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
