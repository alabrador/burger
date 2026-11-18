import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { markPaid, markPaymentFailed } from "@/server/orders";
import { redsysVerify } from "@/server/payments/redsys";
import { paymentConfig } from "@/server/settings";

/** Notificación servidor a servidor de Redsys (Bizum). Es la única fuente de verdad del pago. */
export const POST = handle(async (req) => {
  const form = await req.formData();
  const params = String(form.get("Ds_MerchantParameters") || "");
  const sig = String(form.get("Ds_Signature") || "");
  const c = (await paymentConfig()).bizum;
  const v = params && sig && c.secretKey ? redsysVerify(c.secretKey, params, sig) : null;
  if (!v) return new Response("firma no válida", { status: 400 });
  const [p] = await db()
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, "bizum"), eq(schema.payments.providerRef, v.order)));
  if (!p) return new Response("pedido desconocido", { status: 404 });
  if (v.ok) await markPaid(p.orderId, "bizum", v.order, v.amountCents, v.raw);
  else await markPaymentFailed(p.orderId, "bizum", `${v.order}-${v.response}`, `Bizum rechazado (código ${v.response})`);
  return new Response("OK");
});
