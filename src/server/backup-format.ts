/**
 * Formato de las copias de la base de datos hechas desde la propia app (cron de Vercel).
 * Sin dependencias de Next: lo usan el servidor y scripts/backup/restore-app.mts.
 *
 * Archivo .cbk = "CBK1" | sal (16) | iv (12) | etiqueta GCM (16) | AES-256-GCM( gzip( JSON ) )
 * La clave sale de BACKUP_PASSPHRASE con scrypt. Sin la frase no se puede leer.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type postgres from "postgres";

const MAGIC = Buffer.from("CBK1");

export type BackupData = {
  format: 1;
  createdAt: string;
  migrations: number;
  tables: Record<string, unknown[]>;
};

const key = (pass: string, salt: Buffer) => {
  if (!pass || pass.length < 20) throw new Error("BACKUP_PASSPHRASE debe tener al menos 20 caracteres");
  return scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
};

export function encryptBackup(data: BackupData, pass: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(pass, salt), iv);
  const body = Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 })), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

export function decryptBackup(buf: Buffer, pass: string): BackupData {
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error("No es una copia de Crea tu Burger (.cbk)");
  const salt = buf.subarray(4, 20);
  const iv = buf.subarray(20, 32);
  const tag = buf.subarray(32, 48);
  const d = createDecipheriv("aes-256-gcm", key(pass, salt), iv);
  d.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([d.update(buf.subarray(48)), d.final()]);
  } catch {
    throw new Error("Frase de paso incorrecta o copia dañada");
  }
  return JSON.parse(gunzipSync(plain).toString("utf8")) as BackupData;
}

type Sql = postgres.Sql;

/** Tablas de la app (esquema public) ordenadas para insertar: primero las referenciadas. */
export async function tablesInOrder(sql: Sql): Promise<string[]> {
  const tables = (await sql<{ t: string }[]>`
    select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`).map((r) => r.t);
  const deps = await sql<{ child: string; parent: string }[]>`
    select c.relname as child, p.relname as parent from pg_constraint k
    join pg_class c on c.oid = k.conrelid join pg_class p on p.oid = k.confrelid
    join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'f' and n.nspname = 'public' and c.relname <> p.relname`;
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (t: string, path: Set<string>) => {
    if (seen.has(t) || path.has(t)) return;
    path.add(t);
    for (const d of deps) if (d.child === t) visit(d.parent, path);
    seen.add(t);
    out.push(t);
  };
  for (const t of tables) visit(t, new Set());
  return out;
}

const ident = (t: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`Nombre de tabla no válido: ${t}`);
  return `"${t}"`;
};

/** Lee todas las tablas como JSON (bytea queda en hexadecimal "\\x…", que Postgres vuelve a leer igual). */
export async function dumpDatabase(sql: Sql): Promise<BackupData> {
  const tables: Record<string, unknown[]> = {};
  for (const t of await tablesInOrder(sql)) {
    const [r] = await sql.unsafe(`select coalesce(json_agg(x), '[]'::json) as rows from ${ident(t)} x`);
    tables[t] = r.rows as unknown[];
  }
  const [m] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
  return { format: 1, createdAt: new Date().toISOString(), migrations: Number(m.n), tables };
}

/**
 * Restaura una copia en una base con el esquema ya migrado. Todo en una transacción:
 * si algo falla, la base queda como estaba.
 */
export async function restoreDatabase(sql: Sql, data: BackupData): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await sql.begin(async (tx) => {
    const order = await tablesInOrder(tx as unknown as Sql);
    const present = new Set(order);
    const missing = Object.keys(data.tables).filter((t) => !present.has(t));
    if (missing.length) throw new Error(`La base de destino no tiene las tablas: ${missing.join(", ")}. Aplica antes las migraciones.`);
    await tx.unsafe(`truncate ${order.map(ident).join(", ")} restart identity cascade`);
    for (const t of order) {
      const rows = data.tables[t] ?? [];
      counts[t] = rows.length;
      // Por lotes para no mandar un único JSON gigante.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = JSON.stringify(rows.slice(i, i + 500));
        await tx.unsafe(`insert into ${ident(t)} select * from json_populate_recordset(null::${ident(t)}, $1::json)`, [chunk]);
      }
      // Los contadores (bigserial) siguen desde el último id restaurado.
      const seqs = await tx<{ col: string; seq: string }[]>`
        select a.attname as col, pg_get_serial_sequence(${ident(t)}, a.attname) as seq from pg_attribute a
        where a.attrelid = ${ident(t)}::regclass and a.attnum > 0 and not a.attisdropped and pg_get_serial_sequence(${ident(t)}, a.attname) is not null`;
      for (const s of seqs)
        await tx.unsafe(`select setval($1, coalesce((select max(${ident(s.col)}) from ${ident(t)}), 0) + 1, false)`, [s.seq]);
    }
  });
  return counts;
}

export const rowCounts = (d: BackupData) => Object.fromEntries(Object.entries(d.tables).map(([t, r]) => [t, r.length]));
