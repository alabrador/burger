import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { db, schema } from "../db";
import { getSettings, smtpConfig } from "../settings";
import { render, type MailOrder, type Template } from "./templates";
import { reportError } from "../errors";

type Tx = Parameters<Parameters<ReturnType<typeof import("../db").db>["transaction"]>[0]>[0];

/** Encola un correo dentro de la misma transacción que cambia el pedido (patrón outbox). */
export async function enqueue(tx: Tx, template: Template, to: string, order: MailOrder & { id: string }) {
  const store = (await getSettings()).store;
  const m = render(template, order, store);
  await tx.insert(schema.emailOutbox).values({ to, subject: m.subject, html: m.html, text: m.text, template, orderId: order.id });
}

const BACKOFF_MIN = [1, 5, 30, 120, 360];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

let transport: { key: string; t: Transporter } | null = null;
async function getTransport() {
  const c = await smtpConfig();
  if (!c.host || !c.fromEmail) return null;
  const key = JSON.stringify([c.host, c.port, c.secure, c.user, c.pass]);
  if (transport?.key !== key) {
    transport = {
      key,
      t: nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.secure,
        auth: c.user ? { user: c.user, pass: c.pass } : undefined,
        pool: true,
        maxConnections: 3,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        requireTLS: !c.secure && c.port === 587,
      }),
    };
  }
  return { t: transport.t, from: { name: c.fromName, address: c.fromEmail }, replyTo: c.replyTo || undefined };
}

/**
 * Envío inmediato (sin cola) para códigos de acceso: el cliente está esperando.
 * Con MAIL_DEV_LOG=1 y sin SMTP, el correo se escribe en el registro del servidor (solo pruebas).
 */
export async function sendNow(m: { to: string; subject: string; html: string; text: string }) {
  const tr = await getTransport();
  if (!tr) {
    if (process.env.MAIL_DEV_LOG === "1") {
      console.log(`[mail] ${m.to} · ${m.subject}\n${m.text}`);
      return;
    }
    throw new Error("SMTP sin configurar");
  }
  await tr.t.sendMail({ from: tr.from, replyTo: tr.replyTo, to: m.to, subject: m.subject, html: m.html, text: m.text });
}

export async function sendTest(to: string) {
  const tr = await getTransport();
  if (!tr) throw new Error("SMTP sin configurar (servidor y remitente)");
  await tr.t.verify();
  await tr.t.sendMail({ from: tr.from, to, subject: "Prueba de correo · Crea tu Burger", text: "Si lees esto, el SMTP funciona.", html: "<p>Si lees esto, el <b>SMTP funciona</b>.</p>" });
}

/**
 * Envía correos pendientes. Usa FOR UPDATE SKIP LOCKED para que varias instancias
 * (o el cron y un after()) no envíen el mismo correo dos veces.
 */
export async function processOutbox(limit = 20, onlyOrderId?: string) {
  const tr = await getTransport();
  if (!tr) return { sent: 0, failed: 0, skipped: "smtp" };
  const claimed = await db().transaction(async (tx) => {
    const rows = await tx
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(
        and(
          eq(schema.emailOutbox.status, "pending"),
          lte(schema.emailOutbox.nextAttemptAt, sql`now()`),
          onlyOrderId ? eq(schema.emailOutbox.orderId, onlyOrderId) : undefined,
        ),
      )
      .orderBy(schema.emailOutbox.id)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    return tx
      .update(schema.emailOutbox)
      .set({ status: "sending", attempts: sql`${schema.emailOutbox.attempts} + 1`, nextAttemptAt: sql`now()` })
      .where(sql`${schema.emailOutbox.id} in ${ids}`)
      .returning();
  });
  let sent = 0;
  let failed = 0;
  for (const m of claimed) {
    try {
      await tr.t.sendMail({ from: tr.from, replyTo: tr.replyTo, to: m.to, subject: m.subject, html: m.html, text: m.text });
      await db().update(schema.emailOutbox).set({ status: "sent", sentAt: sql`now()`, lastError: null }).where(eq(schema.emailOutbox.id, m.id));
      sent++;
    } catch (e) {
      failed++;
      const done = m.attempts >= MAX_ATTEMPTS;
      await db()
        .update(schema.emailOutbox)
        .set({
          status: done ? "failed" : "pending",
          lastError: String((e as Error).message).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + (BACKOFF_MIN[m.attempts - 1] ?? 360) * 60_000),
        })
        .where(eq(schema.emailOutbox.id, m.id));
      // Aviso solo cuando se agotan los reintentos (o al primer fallo, para enterarse pronto de un SMTP roto).
      if (done || m.attempts === 1)
        await reportError("mail", e, { path: done ? "correo descartado tras reintentos" : "envío de correo", level: done ? "error" : "warn", detail: `Plantilla ${m.template}` });
    }
  }
  return { sent, failed };
}

/** Correos que quedaron en "sending" por un corte (más de 10 min) vuelven a la cola. */
export async function requeueStuck() {
  await db()
    .update(schema.emailOutbox)
    .set({ status: "pending" })
    .where(and(eq(schema.emailOutbox.status, "sending"), lte(schema.emailOutbox.nextAttemptAt, sql`now() - interval '10 minutes'`)));
}
