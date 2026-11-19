import { ApiError, body, clientIp, handle, json, limit } from "@/server/http";
import { createOrder, createOrderSchema, setStatus } from "@/server/orders";
import { startPayment } from "@/server/payments";
import { trackToken } from "@/server/tokens";
import { reportError } from "@/server/errors";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await limit(req, "order-ip", 8, 60); // 8 pedidos/min por IP
  const input = await body(req, createOrderSchema);
  await limit(req, "order-email", 5, 600, input.customer.email); // 5 cada 10 min por correo
  const idem = req.headers.get("idempotency-key");
  if (idem && !/^[A-Za-z0-9-]{16,64}$/.test(idem)) throw new ApiError(400, "Idempotency-Key no válida", "bad_idem");

  const { order, replay } = await createOrder(input, ip, idem);
  let payment;
  try {
    payment = await startPayment(order);
  } catch (e) {
    await reportError("payment", e, { path: `iniciar pago ${order.paymentMethod}` });
    if (!replay) await setStatus(order.id, "cancelled", null, { reason: "No se pudo iniciar el pago", notify: false }).catch(() => {});
    throw new ApiError(502, "No pudimos conectar con la pasarela de pago. Prueba otro método.", "payment_unavailable");
  }
  return json({ code: order.code, token: trackToken(order.code), status: order.status, totalCents: order.totalCents, payment }, replay ? 200 : 201);
});
