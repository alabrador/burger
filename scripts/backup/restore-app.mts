/**
 * Restaura una copia .cbk (las que hace la web cada noche y se descargan en Admin → Copias).
 *
 *   BACKUP_PASSPHRASE=... npx tsx scripts/backup/restore-app.mts copia.cbk --check
 *       Solo abre la copia y muestra cuántas filas tiene cada tabla (no toca ninguna base).
 *
 *   BACKUP_PASSPHRASE=... RESTORE_DATABASE_URL=postgres://... npx tsx scripts/backup/restore-app.mts copia.cbk
 *       Aplica las migraciones en la base de destino y SUSTITUYE todos sus datos por los de la copia.
 *       Pide confirmación (o --yes). Todo va en una transacción: si falla, la base queda como estaba.
 *
 * Recomendado: restaurar en una base NUEVA (rama de Neon o proyecto vacío) y luego apuntar Vercel a ella.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { decryptBackup, restoreDatabase, rowCounts } from "../../src/server/backup-format";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("Uso: restore-app.mts copia.cbk [--check] [--yes]");
  process.exit(1);
}
const pass = process.env.BACKUP_PASSPHRASE || "";
const data = decryptBackup(readFileSync(file), pass);
console.log(`Copia del ${data.createdAt} (${data.migrations} migraciones):`);
for (const [t, n] of Object.entries(rowCounts(data))) console.log(`  ${t}: ${n}`);
if (flags.includes("--check")) process.exit(0);

const url = process.env.RESTORE_DATABASE_URL;
if (!url) throw new Error("Falta RESTORE_DATABASE_URL (conexión directa a la base de destino)");
if (!flags.includes("--yes")) {
  const host = url.replace(/^[a-z]+:\/\/([^@]*@)?([^/:?]+).*/, "$2");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = await rl.question(`Se van a SUSTITUIR todos los datos de la base en ${host}. Escribe RESTAURAR para seguir: `);
  rl.close();
  if (ok.trim() !== "RESTAURAR") {
    console.log("Cancelado");
    process.exit(1);
  }
}
const sql = postgres(url, { max: 1, prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
const counts = await restoreDatabase(sql, data);
console.log("Restaurada. Filas:", Object.values(counts).reduce((a, b) => a + b, 0));
await sql.end();
