"use client";

import { Ban, Check, ChefHat, PackageCheck, Printer, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { api, dt, eur, hm, METHOD } from "./api";
import { useMe } from "./shell";
import { Btn, Field, inputCls, PayBadge, StatusBadge, useData, useToast } from "./ui";

export type OrderFull = {
  order: {
    id: string; code: string; status: string; paymentStatus: string; paymentMethod: string; customerName: string; customerEmail: string; customerPhone: string | null;
    subtotalCents: number; discountCents: number; totalCents: number; taxCents: number; couponCode: string | null; pickupAt: string | null; notes: string | null; createdAt: string; customerId: string | null;
  };
  items: { id: number; quantity: number; title: string; description: string; totalCents: number; unitPriceCents: number }[];
  events: { id: number; type: string; message: string | null; createdAt: string }[];
  payments: { id: string; provider: string; providerRef: string | null; status: string; amountCents: number; refundedCents: number; createdAt: string }[];
  qr: string;
};

const EV: Record<string, string> = {
  created: "Pedido creado",
  "payment:paid": "Pago recibido",
  "payment:failed": "Pago fallido",
  "payment:refunded": "Reembolso",
  "payment:mismatch": "Importe no coincide",
  "status:confirmed": "Confirmado",
  "status:preparing": "En preparación",
  "status:ready": "Listo para recoger",
  "status:collected": "Entregado",
  "status:cancelled": "Cancelado",
  note: "Nota",
};

export function OrderDetail({ id, onChange }: { id: string; onChange?: () => void }) {
  const me = useMe();
  const toast = useToast();
  const { data, reload } = useData(() => api<OrderFull>(`/api/admin/orders/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [refundAmt, setRefundAmt] = useState<string | null>(null);

  if (!data) return <p className="text-sm text-muted">Cargando…</p>;
  const { order: o, items, events, payments } = data;
  const cashDue = o.paymentMethod === "cash" && o.paymentStatus !== "paid";

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body });
      toast(ok);
      await reload();
      onChange?.();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const refund = async () => {
    const cents = refundAmt ? Math.round(Number(refundAmt.replace(",", ".")) * 100) : null;
    if (refundAmt && (!cents || cents <= 0)) return toast("Importe no válido", "err");
    if (!confirm(`¿Reembolsar ${cents ? eur(cents) : "el total"} del pedido ${o.code}?`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/orders/${id}/refund`, { method: "POST", body: { amountCents: cents } });
      toast("Reembolso realizado");
      setRefundAmt(null);
      await reload();
      onChange?.();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl font-extrabold tracking-widest">{o.code}</span>
        <StatusBadge s={o.status} />
        <PayBadge s={o.paymentStatus} />
        <span className="ml-auto text-xs text-muted">{dt(o.createdAt)}</span>
      </div>

      {/* acciones según estado */}
      <div className="flex flex-wrap gap-2">
        {o.status === "confirmed" && (
          <Btn variant="gold" disabled={busy} onClick={() => act({ status: "preparing" }, "En preparación")}>
            <ChefHat className="size-4" /> Empezar a preparar
          </Btn>
        )}
        {(o.status === "confirmed" || o.status === "preparing") && (
          <Btn variant="ok" disabled={busy} onClick={() => act({ status: "ready" }, "Marcado como listo")}>
            <Check className="size-4" /> Listo para recoger
          </Btn>
        )}
        {o.status === "ready" && (
          <Btn variant="ok" disabled={busy} onClick={() => (!cashDue || confirm(`¿Has cobrado ${eur(o.totalCents)} en efectivo?`)) && act({ status: "collected", cashPaid: cashDue || undefined }, "Pedido entregado")}>
            <PackageCheck className="size-4" /> {cashDue ? `Cobrar ${eur(o.totalCents)} y entregar` : "Entregar"}
          </Btn>
        )}
        {o.status === "pending_payment" && o.paymentStatus === "paid" && (
          <Btn variant="gold" disabled={busy} onClick={() => act({ status: "confirmed" }, "Confirmado")}>
            Confirmar
          </Btn>
        )}
        <Btn onClick={() => window.open(`/admin/ticket?id=${o.id}`, "_blank", "noopener,width=420,height=700")}>
          <Printer className="size-4" /> Ticket
        </Btn>
        {!["collected", "cancelled"].includes(o.status) && me.role !== "kitchen" && (
          <Btn variant="danger" disabled={busy} onClick={() => setCancelReason("")}>
            <Ban className="size-4" /> Cancelar
          </Btn>
        )}
      </div>

      {cancelReason !== null && (
        <div className="rounded-lg border border-red/40 bg-red/10 p-3">
          <Field label="Motivo de la cancelación (se guarda en el historial)">
            <input className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} autoFocus />
          </Field>
          {o.paymentStatus === "paid" && <p className="mt-2 text-xs text-red-200">Está pagado: después haz el reembolso abajo.</p>}
          <div className="mt-2 flex gap-2">
            <Btn variant="danger" size="sm" disabled={busy} onClick={() => act({ status: "cancelled", reason: cancelReason || undefined }, "Pedido cancelado").then(() => setCancelReason(null))}>
              Confirmar cancelación
            </Btn>
            <Btn size="sm" onClick={() => setCancelReason(null)}>
              Volver
            </Btn>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Cliente">
          <div className="font-medium">{o.customerName}</div>
          <a className="text-muted hover:text-gold" href={`mailto:${o.customerEmail}`}>
            {o.customerEmail}
          </a>
          {o.customerPhone && (
            <a className="block text-muted hover:text-gold" href={`tel:${o.customerPhone}`}>
              {o.customerPhone}
            </a>
          )}
        </Info>
        <Info label="Recogida">
          <div className="font-display text-lg font-bold">{hm(o.pickupAt)}</div>
          <div className="text-muted">{dt(o.pickupAt, { weekday: "long", day: "numeric", month: "long" })}</div>
        </Info>
      </div>
      {o.notes && <Info label="Nota del cliente">{o.notes}</Info>}

      <div>
        <h3 className="mb-2 text-xs font-medium text-muted">Productos</h3>
        <ul className="divide-y divide-line/60 rounded-lg border border-line">
          {items.map((i) => (
            <li key={i.id} className="flex gap-3 p-3">
              <span className="font-display text-lg font-bold text-gold">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.title}</span>
                <span className="block text-xs text-muted">{i.description}</span>
              </span>
              <span className="tabular-nums">{eur(i.totalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 text-right text-xs text-muted">
          {o.discountCents > 0 && (
            <div>
              Descuento {o.couponCode && `(${o.couponCode})`}: −{eur(o.discountCents)}
            </div>
          )}
          <div>IVA incluido: {eur(o.taxCents)}</div>
          <div className="text-base font-bold text-ink">Total {eur(o.totalCents)}</div>
          <div>{METHOD[o.paymentMethod]}</div>
        </dl>
      </div>

      {me.perms.includes("payments.view") && payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted">Pagos</h3>
          <ul className="space-y-1 text-xs">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-md bg-panel-2 px-2.5 py-1.5">
                <span>
                  {METHOD[p.provider]} · <PayBadge s={p.status} /> <span className="text-muted">{p.providerRef}</span>
                </span>
                <span className="tabular-nums">
                  {eur(p.amountCents)}
                  {p.refundedCents > 0 && <span className="text-violet-300"> (−{eur(p.refundedCents)})</span>}
                </span>
              </li>
            ))}
          </ul>
          {me.perms.includes("orders.refund") && ["paid", "partially_refunded"].includes(o.paymentStatus) && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              {refundAmt !== null ? (
                <>
                  <Field label="Importe (vacío = todo)" className="w-40">
                    <input className={inputCls} inputMode="decimal" placeholder={(o.totalCents / 100).toFixed(2)} value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} />
                  </Field>
                  <Btn variant="danger" size="sm" disabled={busy} onClick={refund}>
                    Reembolsar
                  </Btn>
                  <Btn size="sm" onClick={() => setRefundAmt(null)}>
                    Volver
                  </Btn>
                </>
              ) : (
                <Btn size="sm" onClick={() => setRefundAmt("")}>
                  <RotateCcw className="size-3.5" /> Reembolsar
                </Btn>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium text-muted">Historial</h3>
        <ol className="space-y-1.5 border-l border-line pl-3 text-xs">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-muted">{dt(e.createdAt)}</span> · <span className="font-medium">{EV[e.type] ?? e.type}</span>
              {e.message && <span className="text-muted"> — {e.message}</span>}
            </li>
          ))}
        </ol>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) act({ note: note.trim() }, "Nota añadida").then(() => setNote(""));
          }}
        >
          <input className={inputCls} placeholder="Añadir nota interna…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <Btn size="md" disabled={busy || !note.trim()} aria-label="Añadir nota">
            <Send className="size-4" />
          </Btn>
        </form>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-panel-2 p-3">
      <div className="mb-1 text-[11px] font-medium text-muted uppercase">{label}</div>
      {children}
    </div>
  );
}
