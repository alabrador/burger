"use client";

import { DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, dt } from "../../_lib/api";
import { Btn, Card, Empty, PageHead, Table, useData, useToast } from "../../_lib/ui";

type B = { pathname: string; size: number; uploadedAt: string };
type D = { ready: { passphrase: boolean; passphraseState?: "ok" | "missing" | "short"; blob: boolean }; backups: B[]; listError?: string };

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Copias() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useData(() => api<D>("/api/admin/backups"));
  const ready = data?.ready.passphrase && data?.ready.blob;

  const now = async () => {
    setBusy(true);
    try {
      const r = await api<{ size: number; rows: number }>("/api/admin/backups", { method: "POST" });
      toast(`Copia hecha y comprobada: ${r.rows} filas, ${size(r.size)}`);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title="Copias de seguridad"
        sub="Cada noche se guarda una copia cifrada de toda la base de datos (pedidos, clientes, carta, fotos y configuración). Se conservan 30 días, y las del domingo 90."
        actions={
          <Btn variant="gold" onClick={now} disabled={busy || !ready}>
            <DatabaseBackup className="size-4" /> {busy ? "Haciendo copia…" : "Hacer copia ahora"}
          </Btn>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red/10 px-4 py-3 text-sm text-red">{error}</p>}
      {data?.listError && (
        <p className="mb-4 rounded-xl bg-red/10 px-4 py-3 text-sm text-red">
          No se puede leer el almacén Blob: {data.listError}. Revisa que el almacén esté conectado a este proyecto en Production.
        </p>
      )}
      {data && !ready && (
        <Card className="mb-4" title="Falta configurar las copias">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {!data.ready.blob && (
              <li>
                En Vercel → Storage → <b>Create → Blob</b>, elige acceso <b>Private</b> y conéctalo a este proyecto (Vercel crea solo las variables <code>BLOB_…</code>).
              </li>
            )}
            {data.ready.passphraseState === "short" && (
              <li>
                <code>BACKUP_PASSPHRASE</code> existe pero es demasiado corta: necesita <b>20 caracteres o más</b>. Cámbiala en Vercel → Settings → Environment Variables.
              </li>
            )}
            {!data.ready.passphrase && data.ready.passphraseState !== "short" && (
              <li>
                En Vercel → Settings → Environment Variables, añade <code>BACKUP_PASSPHRASE</code> con una frase de 20 caracteres o más. Guárdala también en tu gestor de contraseñas: sin ella no se puede abrir ninguna copia.
              </li>
            )}
            <li>
              Comprueba que las variables están marcadas para <b>Production</b>, vuelve a desplegar (Deployments → ⋯ → Redeploy) y pulsa «Hacer copia ahora». Vercel solo aplica las variables nuevas en un despliegue nuevo.
            </li>
          </ol>
        </Card>
      )}
      <Card title="Copias guardadas" icon={<ShieldCheck className="size-4" />} sub="Cada copia se comprueba al hacerla: se vuelve a abrir con la frase y se cuentan las filas.">
        {data && !data.backups.length ? (
          <Empty icon={<DatabaseBackup className="size-8" />}>Aún no hay copias.</Empty>
        ) : (
          <Table head={["Fecha", "Archivo", "Tamaño", ""]}>
            {data?.backups.map((b) => (
              <tr key={b.pathname}>
                <td className="whitespace-nowrap">{dt(b.uploadedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="font-mono text-xs text-muted">{b.pathname.replace("copias/", "")}</td>
                <td className="tabular-nums">{size(b.size)}</td>
                <td className="text-right">
                  <a href={`/api/admin/backups/download?p=${encodeURIComponent(b.pathname)}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-panel-2">
                    <Download className="size-3.5" /> Descargar
                  </a>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-4 text-xs text-muted">Para restaurar una copia sigue la guía docs/recuperacion.md del repositorio (script scripts/backup/restore-app.mts).</p>
      </Card>
    </>
  );
}
