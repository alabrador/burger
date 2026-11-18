import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { json } from "@/server/http";
import { kv } from "@/server/redis";

export async function GET() {
  const t = Date.now();
  const [pg, rd] = await Promise.allSettled([db().execute(sql`select 1`), kv().set("health", String(t), 30)]);
  const ok = pg.status === "fulfilled" && rd.status === "fulfilled";
  return json({ ok, db: pg.status === "fulfilled", redis: rd.status === "fulfilled", ms: Date.now() - t }, ok ? 200 : 503);
}
