/**
 * Aplica las migraciones de ./drizzle. Usa DATABASE_URL_DIRECT si existe
 * (conexión directa, sin pooler), si no DATABASE_URL.
 *   npm run db:migrate
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const e = process.env;
const url = e.DATABASE_URL_DIRECT || e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_URL;
if (!url) {
  // En el build de Vercel (--optional) sin base de datos configurada, no hacemos nada.
  if (process.argv.includes("--optional")) {
    console.log("Sin DATABASE_URL: se omite " + (import.meta.url.includes("seed") ? "la carga de datos" : "la migración"));
    process.exit(0);
  }
  throw new Error("Falta DATABASE_URL");
}
const sql = postgres(url, { max: 1, prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
console.log("Migraciones aplicadas");
await sql.end();
