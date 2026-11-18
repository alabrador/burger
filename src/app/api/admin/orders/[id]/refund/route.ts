import { z } from "zod";
import { admin } from "@/server/admin";
import { body, json, limit } from "@/server/http";
import { refund } from "@/server/payments";

export const POST = admin<RouteContext<"/api/admin/orders/[id]/refund">>("orders.refund", async (req, me, log, ctx) => {
  await limit(req, "refund", 20, 600, me.id);
  const id = z.string().uuid().parse((await ctx.params).id);
  const b = await body(req, z.object({ amountCents: z.number().int().positive().max(1_000_000).nullable().optional() }), 512);
  const r = await refund(id, b.amountCents ?? null, me);
  await log("order.refund", "order", id, r);
  return json(r);
});
