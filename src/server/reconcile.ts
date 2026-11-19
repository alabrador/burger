import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { reportError } from "./errors";
import { markPaid } from "./orders";
import { stripe } from "./payments/stripe";
import { paymentConfig } from "./settings";

const DAYS = 3;
const STATUS: Record<string, string> = { pending_payment: "pendiente de pago", confirmed: "confirmado", preparing: "en preparación", ready: "listo", collected: "entregado", cancelled: "cancelado" };

export type Reconcile = {
  checkedStripe: number;
  fixed: string[];
  issues: { kind: string; items: string[] }[];
};

/**
 * Conciliación diaria entre pedidos y cobros (la lanza /api/cron).
 * - Corrige sola lo que es seguro: un cobro de Stripe completado cuyo pedido no figura como pagado
 *   (markPaid comprueba el importe y es idempotente).
 * - Avisa por correo de lo que necesita una persona: cobros sin pedido, pedidos pagados sin cobro
 *   y cobros registrados en pedidos que no figuran como pagados (p. ej. importe distinto).
 */
export async function reconcilePayments(): Promise<Reconcile> {
  const out: Reconcile = { checkedStripe: 0, fixed: [], issues: [] };
  const issue = (kind: string, items: string[]) => items.length && out.issues.push({ kind, items });

  // 1. Stripe (primero, para que lo corregido no salga después como problema): cobros completados de los últimos días.
  const pay = await paymentConfig();
  if (pay.stripe.enabled) {
    try {
      const { s } = await stripe();
      const since = Math.floor(Date.now() / 1000) - DAYS * 86400;
      const known = new Set(
        (
          await db().execute<{ ref: string }>(sql`
            select provider_ref as ref from payments where provider = 'stripe' and created_at > now() - make_interval(days => ${DAYS + 1})`)
        ).map((r) => r.ref),
      );
      const drafts = new Map(
        (
          await db().execute<{ id: string; pi: string; order_id: string | null }>(sql`
            select id, payment_intent_id as pi, order_id from card_drafts where created_at > now() - make_interval(days => ${DAYS + 1})`)
        ).map((d) => [d.pi, d]),
      );
      const orphan: string[] = [];
      for await (const pi of s.paymentIntents.list({ created: { gte: since }, limit: 100 })) {
        if (pi.status !== "succeeded") continue;
        out.checkedStripe++;
        if (known.has(pi.id)) continue;
        // Cobro sin pedido aún: si es reciente puede estar terminando de crearse.
        if (Date.now() / 1000 - pi.created < 30 * 60) continue;
        const amount = `${(pi.amount_received / 100).toFixed(2)} €`;
        if (pi.metadata?.orderId) {
          // Seguro de corregir: el pedido existe y markPaid comprueba el importe.
          await markPaid(pi.metadata.orderId, "stripe", pi.id, pi.amount_received, { reconcile: true });
          out.fixed.push(`${pi.metadata.code ?? pi.metadata.orderId} · ${pi.id} · ${amount}`);
        } else if (pi.metadata?.draft) {
          const d = drafts.get(pi.id);
          if (!d?.order_id) orphan.push(`${pi.id} · ${amount} · ${pi.receipt_email ?? "sin correo"} (formulario de tarjeta sin pedido)`);
        } else orphan.push(`${pi.id} · ${amount} · ${pi.description ?? "sin descripción"}`);
      }
      issue("Cobros de Stripe sin pedido (reembolsar en Stripe o crear el pedido a mano)", orphan);
    } catch (e) {
      await reportError("payment", e, { path: "conciliación con Stripe", level: "warn" });
    }
  }

  // 2. Pedidos marcados como pagados sin ningún cobro registrado (no aplica a efectivo).
  const paidNoPayment = await db().execute<{ code: string; method: string; total: number }>(sql`
    select o.code, o.payment_method as method, o.total_cents as total from orders o
    where o.payment_status in ('paid','partially_refunded','refunded') and o.payment_method <> 'cash'
      and o.created_at > now() - make_interval(days => ${DAYS})
      and not exists (select 1 from payments p where p.order_id = o.id and p.status in ('paid','partially_refunded','refunded'))
    limit 50`);
  issue(
    "Pedidos pagados sin cobro registrado",
    paidNoPayment.map((r) => `${r.code} · ${r.method} · ${(r.total / 100).toFixed(2)} €`),
  );

  // 3. Cobros completados en pedidos que no figuran como pagados (importe distinto, pedido cancelado…).
  const payNoPaid = await db().execute<{ code: string; provider: string; ref: string; amount: number; total: number; status: string }>(sql`
    select o.code, p.provider, p.provider_ref as ref, p.amount_cents as amount, o.total_cents as total, o.status from payments p
    join orders o on o.id = p.order_id
    where p.status = 'paid' and o.payment_status not in ('paid','partially_refunded','refunded')
      and p.created_at > now() - make_interval(days => ${DAYS})
    limit 50`);
  issue(
    "Cobros en pedidos que no figuran como pagados (revisar y reembolsar)",
    payNoPaid.map((r) => `${r.code} · ${r.provider} ${r.ref} · cobrado ${(r.amount / 100).toFixed(2)} € de ${(r.total / 100).toFixed(2)} € · pedido ${STATUS[r.status] ?? r.status}`),
  );

  for (const i of out.issues)
    await reportError("payment", `Conciliación: ${i.kind} (${i.items.length})`, { path: "conciliación diaria", detail: i.items.join("\n") });
  if (out.fixed.length)
    await reportError("payment", `Conciliación: ${out.fixed.length} pedido(s) marcados como pagados (el aviso de Stripe no había llegado)`, {
      path: "conciliación diaria",
      level: "warn",
      detail: out.fixed.join("\n"),
    });
  return out;
}
