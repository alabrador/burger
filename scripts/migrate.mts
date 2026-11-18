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
if (!url) throw new Error("Falta DATABASE_URL");
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
console.log("Migraciones aplicadas");
await sql.end();
