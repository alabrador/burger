import "server-only";
import { sql } from "drizzle-orm";
import { sha256 } from "./crypto";
import { db, schema } from "./db";

export type ErrorSource = "api" | "render" | "client" | "payment" | "webhook" | "mail" | "cron";
type Opts = { path?: string | null; level?: "error" | "warn"; detail?: string; alert?: boolean };

/** Máximo un correo por causa cada hora, y como mucho 20 al día en total. */
const ALERT_EVERY_MIN = 60;
const ALERT_MAX_PER_DAY = 20;
const memAlerts = new Map<string, number>();

/** Quita credenciales y claves que pudieran colarse en un mensaje de error. */
export function redact(s: string): string {
  return s
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1***:***@")
    .replace(/\b(sk|rk|pk|whsec)_(live|test)?_?[A-Za-z0-9]{8,}/g, "$1_***")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 ***")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => m[0] + "***@" + m.split("@")[1]);
}

/** Ruta sin ids ni números, para que el mismo fallo en pedidos distintos cuente como uno. */
function normPath(p?: string | null) {
  return (p || "").split("?")[0].replace(/\/[0-9a-f-]{8,}|\/\d+|\/CB-[A-Z0-9-]+/gi, "/:id").slice(0, 200);
}

function describe(e: unknown): { message: string; stack?: string } {
  if (e instanceof Error) {
    const digest = "digest" in e && e.digest ? ` [${String(e.digest)}]` : "";
    return { message: `${e.name !== "Error" ? e.name + ": " : ""}${e.message}${digest}`, stack: e.stack };
  }
  return { message: typeof e === "string" ? e : JSON.stringify(e) ?? String(e) };
}

/**
 * Guarda un error en la tabla app_errors (agrupado por causa) y avisa por correo al responsable.
 * Nunca lanza: si la base de datos también falla, se queda en el registro del servidor.
 */
export async function reportError(source: ErrorSource, e: unknown, o: Opts = {}): Promise<void> {
  const d = describe(e);
  const message = redact(d.message).slice(0, 500) || "Error sin mensaje";
  const level = o.level ?? "error";
  const path = normPath(o.path);
  console[level === "warn" ? "warn" : "error"](`[${source}]`, path, e);
  // Huella: mismo origen + ruta + mensaje sin números ni ids.
  const fp = sha256([source, path, message.replace(/[0-9a-f]{8,}|\d+/gi, "#")].join("|")).slice(0, 32);
  const detail = redact(o.detail ?? d.stack ?? "").slice(0, 4000) || null;
  const wantsAlert = o.alert !== false && level === "error" && source !== "client";
  if (isDbDown(e)) {
    // Sin base de datos no se puede guardar: avisamos igualmente (límite en memoria) con la configuración en caché.
    if (wantsAlert && Date.now() - (memAlerts.get(fp) ?? 0) > ALERT_EVERY_MIN * 60_000) {
      memAlerts.set(fp, Date.now());
      await sendAlert({ source, message: `La base de datos no responde: ${message}`, path, count: 1, detail }).catch(() => {});
    }
    return;
  }
  try {
    const [row] = await db()
      .insert(schema.appErrors)
      .values({ fingerprint: fp, source, level, message, detail, path: path || null })
      .onConflictDoUpdate({
        target: schema.appErrors.fingerprint,
        set: { count: sql`${schema.appErrors.count} + 1`, lastAt: sql`now()`, message, detail, level, resolvedAt: null },
      })
      .returning({ id: schema.appErrors.id, count: schema.appErrors.count });
    if (!wantsAlert) return;
    // Reclama el aviso de forma atómica: varias instancias a la vez mandan un solo correo.
    const claimed = await db().execute<{ id: number }>(sql`
      update app_errors set alerted_at = now()
      where id = ${row.id}
        and (alerted_at is null or alerted_at < now() - make_interval(mins => ${ALERT_EVERY_MIN}))
        and (select count(*) from app_errors where alerted_at > now() - interval '1 day') < ${ALERT_MAX_PER_DAY}
      returning id`);
    if (!claimed.length) return;
    await sendAlert({ source, message, path, count: row.count, detail });
  } catch (err) {
    console.error("[errores] no se pudo registrar", err);
  }
}

const SOURCE_LABEL: Record<ErrorSource, string> = {
  api: "Servidor",
  render: "Página",
  client: "Navegador",
  payment: "Pagos",
  webhook: "Aviso de pasarela (webhook)",
  mail: "Correo",
  cron: "Tareas programadas",
};

async function sendAlert(a: { source: ErrorSource; message: string; path: string; count: number; detail: string | null }) {
  const { getSettings } = await import("./settings");
  const { sendNow } = await import("./mail/outbox");
  const st = await getSettings();
  const to = st.orders.alertEmail || st.orders.notifyEmail || st.store.email || process.env.ADMIN_EMAIL || "";
  if (!to) return;
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const link = `${base}/admin/errores`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const label = SOURCE_LABEL[a.source];
  const subject = `⚠️ Fallo en Crea tu Burger · ${label}`;
  const text = [
    `Se ha producido un fallo en ${label.toLowerCase()}${a.path ? ` (${a.path})` : ""}.`,
    "",
    a.message,
    a.count > 1 ? `\nVeces que ha ocurrido: ${a.count}` : "",
    "",
    `Detalle y marcar como resuelto: ${link}`,
    "No recibirás otro aviso de este mismo fallo durante una hora.",
  ].join("\n");
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#1f1b17">
<h2 style="margin:0 0 12px;font-size:18px">Fallo en ${esc(label.toLowerCase())}</h2>
${a.path ? `<p style="margin:0 0 8px;color:#72695f;font-family:monospace">${esc(a.path)}</p>` : ""}
<p style="margin:0 0 12px;padding:12px;background:#fdf1f0;border-left:3px solid #d9261c;font-family:monospace;font-size:13px">${esc(a.message)}</p>
${a.count > 1 ? `<p style="margin:0 0 12px">Veces que ha ocurrido: <b>${a.count}</b></p>` : ""}
<p style="margin:16px 0"><a href="${esc(link)}" style="background:#ffc21a;color:#1f1b17;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ver en el panel</a></p>
<p style="color:#72695f;font-size:12px">No recibirás otro aviso de este mismo fallo durante una hora.</p></div>`;
  await sendNow({ to, subject, html, text });
}

/** Errores de conexión con Postgres (caído, sin red, sin conexiones libres, apagándose). */
export function isDbDown(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  const code = String(err?.code ?? err?.cause?.code ?? "");
  return (
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED"].includes(code) ||
    /^(08|57P0|53300)/.test(code)
  );
}
