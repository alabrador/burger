import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { json } from "@/server/http";
import { redisPing } from "@/server/redis";

/**
 * Estado para monitores externos (UptimeRobot…): 200 si todo va bien, 503 si falla la base de datos.
 * Si solo falla Redis la web sigue funcionando (usa memoria), así que responde 200 con redis: false.
 */
export async function GET() {
  const t = Date.now();
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000));
  const [pg, rd] = await Promise.allSettled([Promise.race([db().execute(sql`select 1`), timeout]), redisPing()]);
  const dbOk = pg.status === "fulfilled";
  const redis = rd.status === "fulfilled" ? rd.value !== false : false;
  return json({ ok: dbOk && redis, db: dbOk, redis, ms: Date.now() - t }, dbOk ? 200 : 503);
}
