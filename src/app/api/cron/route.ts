import { lt, sql } from "drizzle-orm";
import { safeEqual } from "@/server/crypto";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { handle, json } from "@/server/http";
import { processOutbox, requeueStuck } from "@/server/mail/outbox";
import { expireUnpaid } from "@/server/orders";
import { reportError } from "@/server/errors";
import { reconcilePayments } from "@/server/reconcile";
import { nightlyBackup } from "@/server/backup";

// La copia de seguridad puede tardar más que una petición normal.
export const maxDuration = 60;

/**
 * Tareas periódicas: cancela pedidos sin pagar, reintenta correos, limpia sesiones, concilia pagos y hace la copia de seguridad.
 * Protegido con CRON_SECRET (Vercel Cron envía Authorization: Bearer <CRON_SECRET>).
 */
export const GET = handle(async (req) => {
  const secret = env.cronSecret;
  const auth = req.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: "unauthorized" }, 401);
  const expired = await expireUnpaid();
  await requeueStuck();
  const mail = await processOutbox(100);
  await db().delete(schema.sessions).where(lt(schema.sessions.expiresAt, sql`now()`));
  const reconcile = await reconcilePayments().catch(async (e) => {
    await reportError("cron", e, { path: "conciliación de pagos" });
    return null;
  });
  // Errores resueltos de hace más de 90 días ya no aportan nada.
  await db().delete(schema.appErrors).where(sql`resolved_at < now() - interval '90 days'`);
  const backup = await nightlyBackup();
  return json({ expired, mail, reconcile, backup });
});
