import { db, schema } from "@/server/db";
import { handle, json } from "@/server/http";
import { markPaid } from "@/server/orders";
import { paypalVerifyWebhook } from "@/server/payments/paypal";
import { reportError } from "@/server/errors";

type Ev = { id: string; event_type: string; resource: { id: string; custom_id?: string; status?: string; amount?: { value: string; currency_code: string } } };

/** Respaldo por si el cliente cierra la ventana antes de volver de PayPal. */
export const POST = handle(async (req) => {
  const text = await req.text();
  if (text.length > 200_000) return json({ error: "too large" }, 413);
  const ev = JSON.parse(text) as Ev;
  if (!(await paypalVerifyWebhook(req.headers, ev))) {
    await reportError("webhook", "Webhook de PayPal con firma no válida (¿Webhook ID correcto?)", { path: "paypal" });
    return json({ error: "firma no válida" }, 400);
  }
  const r = ev.resource;
  if (ev.event_type === "PAYMENT.CAPTURE.COMPLETED" && r.custom_id && r.amount?.currency_code === "EUR") {
    await markPaid(r.custom_id, "paypal", r.id, Math.round(Number(r.amount.value) * 100), { webhook: ev.id });
  }
  await db().insert(schema.webhookEvents).values({ provider: "paypal", eventId: ev.id }).onConflictDoNothing();
  return json({ received: true });
});
