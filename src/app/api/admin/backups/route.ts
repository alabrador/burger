import { admin } from "@/server/admin";
import { backupReady, listBackups, runBackup } from "@/server/backup";
import { json, limit } from "@/server/http";

export const maxDuration = 60;

export const GET = admin("settings.edit", async () => {
  const ready = backupReady();
  try {
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("el almacén Blob no responde")), 12_000));
    return json({ ready, backups: await Promise.race([listBackups(), timeout]) });
  } catch (e) {
    // Credenciales del Blob presentes pero no válidas: mostramos el motivo en vez de un error genérico.
    return json({ ready, backups: [], listError: (e as Error).message.slice(0, 300) });
  }
});

/** Hacer una copia ahora (además de la diaria). */
export const POST = admin("settings.edit", async (req, me, log) => {
  await limit(req, "backup-now", 3, 3600, me.id);
  const r = await runBackup();
  await log("backup.create", "backup", r.pathname, { size: r.size, rows: r.rows });
  return json(r);
});
