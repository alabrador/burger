import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as unknown as { __cbDb?: DB; __cbSql?: postgres.Sql };

/**
 * Conexión a Postgres (Neon, Supabase o cualquier Postgres 14+).
 * En serverless usa la URL con pooler (Neon "-pooler", Supabase puerto 6543):
 * `prepare: false` lo hace compatible con PgBouncer en modo transacción.
 */
export function db(): DB {
  if (!g.__cbDb) {
    const sql = postgres(env.databaseUrl, {
      max: Number(process.env.DB_POOL_MAX || 5),
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
      ssl: /localhost|127\.0\.0\.1/.test(env.databaseUrl) ? false : "require",
    });
    g.__cbSql = sql;
    g.__cbDb = drizzle(sql, { schema });
  }
  return g.__cbDb;
}

export { schema };
