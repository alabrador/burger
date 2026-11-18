import { body, clientIp, handle, json, limit } from "@/server/http";
import { createOrderSchema } from "@/server/orders";
import { prepareCard } from "@/server/payments/card";

/** Prepara el cobro con tarjeta (aún no crea el pedido). */
export const POST = handle(async (req) => {
  await limit(req, "card-ip", 15, 60);
  const input = await body(req, createOrderSchema);
  await limit(req, "card-email", 10, 600, input.customer.email);
  return json(await prepareCard(input, clientIp(req)));
});
