import { admin } from "@/server/admin";
import { backupReady, listBackups, runBackup } from "@/server/backup";
import { json, limit } from "@/server/http";

export const maxDuration = 60;

export const GET = admin("settings.edit", async () => json({ ready: backupReady(), backups: await listBackups() }));

/** Hacer una copia ahora (además de la diaria). */
export const POST = admin("settings.edit", async (req, me, log) => {
  await limit(req, "backup-now", 3, 3600, me.id);
  const r = await runBackup();
  await log("backup.create", "backup", r.pathname, { size: r.size, rows: r.rows });
  return json(r);
});
