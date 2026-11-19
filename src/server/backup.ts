import "server-only";
import { del, get, list, put } from "@vercel/blob";
import { dumpDatabase, decryptBackup, encryptBackup, rowCounts } from "./backup-format";
import { rawSql } from "./db";
import { reportError } from "./errors";
import { ApiError } from "./http";

const PREFIX = "copias/";
const KEEP_DAYS = 30;
const KEEP_SUNDAY_DAYS = 90;
const access = () => (process.env.BACKUP_BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";

/**
 * Credenciales del almacén Blob. Según cómo se conecte en Vercel hay:
 * - un token BLOB_READ_WRITE_TOKEN (o <PREFIJO>_READ_WRITE_TOKEN si se puso otro prefijo), o
 * - BLOB_STORE_ID (o <PREFIJO>_STORE_ID) con autenticación OIDC automática de Vercel.
 */
function blobAuth(): { token?: string; storeId?: string } | null {
  const e = process.env;
  if (e.BLOB_READ_WRITE_TOKEN) return { token: e.BLOB_READ_WRITE_TOKEN };
  for (const [k, v] of Object.entries(e)) if (k.endsWith("_READ_WRITE_TOKEN") && v?.startsWith("vercel_blob_rw_")) return { token: v };
  if (e.BLOB_STORE_ID) return { storeId: e.BLOB_STORE_ID };
  for (const [k, v] of Object.entries(e)) if (k.endsWith("_STORE_ID") && v?.startsWith("store_")) return { storeId: v };
  return null;
}
const passState = () => {
  const n = (process.env.BACKUP_PASSPHRASE || "").trim().length;
  return n === 0 ? "missing" : n < 20 ? "short" : "ok";
};

export const backupReady = () => ({ passphrase: passState() === "ok", passphraseState: passState(), blob: !!blobAuth() });

export type BackupInfo = { pathname: string; size: number; uploadedAt: string };

/**
 * Copia completa: lee la base, la cifra, comprueba que se puede volver a abrir y que
 * tiene las mismas filas, la sube a Vercel Blob (privado) y borra las copias caducadas.
 */
export async function runBackup(): Promise<{ pathname: string; size: number; rows: number; deleted: number }> {
  const r = backupReady();
  if (!r.passphrase)
    throw new ApiError(503, r.passphraseState === "short" ? "BACKUP_PASSPHRASE es demasiado corta: necesita 20 caracteres o más" : "Falta BACKUP_PASSPHRASE en Vercel");
  if (!r.blob) throw new ApiError(503, "No hay almacén Blob conectado: crea uno en Vercel (Storage → Blob) y conéctalo al proyecto");
  const pass = process.env.BACKUP_PASSPHRASE!.trim();
  const data = await dumpDatabase(rawSql());
  const file = encryptBackup(data, pass);
  // Simulacro: la copia se abre con la frase y tiene exactamente las mismas filas.
  const check = decryptBackup(file, pass);
  if (JSON.stringify(rowCounts(check)) !== JSON.stringify(rowCounts(data))) throw new Error("La copia cifrada no coincide con los datos leídos");
  if (!check.tables.products?.length) throw new Error("La copia no tiene productos: algo va mal en la base");
  const stamp = data.createdAt.replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const blob = await put(`${PREFIX}creatuburger-${stamp}.cbk`, file, {
    access: access(),
    addRandomSuffix: true,
    ...blobAuth(),
    contentType: "application/octet-stream",
  });
  const deleted = await rotate();
  const rows = Object.values(rowCounts(data)).reduce((a, b) => a + b, 0);
  return { pathname: blob.pathname, size: file.length, rows, deleted };
}

/** Borra copias de más de 30 días, salvo las de domingo, que se guardan 90. */
async function rotate() {
  const now = Date.now();
  const old = (await listBackups()).filter((b) => {
    const t = new Date(b.uploadedAt);
    const age = (now - t.getTime()) / 86_400_000;
    return age > (t.getUTCDay() === 0 ? KEEP_SUNDAY_DAYS : KEEP_DAYS);
  });
  if (old.length) await del(old.map((b) => b.pathname), { ...blobAuth() });
  return old.length;
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!backupReady().blob) return [];
  const out: BackupInfo[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000, ...blobAuth(), abortSignal: AbortSignal.timeout(10_000) });
    for (const b of r.blobs) out.push({ pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function openBackup(pathname: string) {
  if (!pathname.startsWith(PREFIX) || pathname.includes("..")) throw new Error("Copia no válida");
  return get(pathname, { access: access(), ...blobAuth() });
}

/** La usa el cron diario: nunca lanza, avisa por correo si falla. */
export async function nightlyBackup() {
  try {
    return await runBackup();
  } catch (e) {
    await reportError("cron", e, { path: "copia de seguridad diaria" });
    return { error: (e as Error).message };
  }
}
