import { lt, sql } from "drizzle-orm";
import { safeEqual } from "@/server/crypto";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { handle, json } from "@/server/http";
import { processOutbox, requeueStuck } from "@/server/mail/outbox";
import { expireUnpaid } from "@/server/orders";

/**
 * Tareas periódicas: cancela pedidos sin pagar, reintenta correos y limpia sesiones.
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
  return json({ expired, mail });
});
