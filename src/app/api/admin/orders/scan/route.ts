import { eq } from "drizzle-orm";
import { z } from "zod";
import { admin } from "@/server/admin";
import { db, schema } from "@/server/db";
import { ApiError, body, json, limit } from "@/server/http";
import { parseQr } from "@/server/tokens";

/** Busca el pedido a partir del QR firmado (o del código tecleado en el mostrador). */
export const POST = admin("orders.update", async (req, me, log) => {
  await limit(req, "scan", 120, 60, me.id);
  const b = await body(req, z.object({ qr: z.string().max(80).optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/).optional() }), 512);
  let code: string | null = null;
  if (b.qr) {
    code = parseQr(b.qr);
    if (!code) {
      await log("scan.invalid", "order", null, { qr: b.qr.slice(0, 40) });
      throw new ApiError(422, "QR no válido o manipulado", "bad_qr");
    }
  } else if (b.code) code = b.code;
  if (!code) throw new ApiError(422, "Escanea un QR o escribe el código", "missing");
  const [o] = await db().select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.code, code));
  if (!o) throw new ApiError(404, `No existe el pedido ${code}`, "not_found");
  return json({ id: o.id, code, viaQr: !!b.qr });
});
