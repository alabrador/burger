import { z } from "zod";
import { admin } from "@/server/admin";
import { openBackup } from "@/server/backup";
import { ApiError, query } from "@/server/http";

const q = z.object({ p: z.string().min(1).max(300) });

/** Descarga una copia (cifrada: solo se abre con BACKUP_PASSPHRASE). */
export const GET = admin("settings.edit", async (req, _me, log) => {
  const { p } = query(req, q);
  const r = await openBackup(p);
  if (!r || r.statusCode !== 200) throw new ApiError(404, "Copia no encontrada", "not_found");
  await log("backup.download", "backup", p);
  const name = p.split("/").pop()!.replace(/[^\w.-]/g, "_");
  return new Response(r.stream, {
    headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
