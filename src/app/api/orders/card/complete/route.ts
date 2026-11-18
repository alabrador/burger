import { z } from "zod";
import { body, handle, json, limit } from "@/server/http";
import { finalizeCard } from "@/server/payments/card";
import { trackToken } from "@/server/tokens";

/** Tras cobrar con tarjeta: comprueba el pago en Stripe y crea el pedido ya pagado. */
export const POST = handle(async (req) => {
  await limit(req, "card-done", 20, 60);
  const { draftId } = await body(req, z.object({ draftId: z.string().uuid() }));
  const o = await finalizeCard(draftId);
  return json({ code: o.code, token: trackToken(o.code), status: o.status });
});
