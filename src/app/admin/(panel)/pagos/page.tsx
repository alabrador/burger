"use client";

import { Scale } from "lucide-react";
import { useState } from "react";
import { api, dt, eur, METHOD } from "../../_lib/api";
import { Btn, Card, cx, Empty, inputCls, PageHead, Pager, PayBadge, Table, useData } from "../../_lib/ui";

type R = { id: string; provider: string; providerRef: string | null; status: string; amountCents: number; refundedCents: number; createdAt: string; orderId: string; code: string; customerName: string };
type Prov = { id: string; enabled: boolean; paid: number; refunded: number };

export default function Pagos() {
  const [f, setF] = useState({ provider: "", page: 1 });
  type Rec = { checkedStripe: number; fixed: string[]; issues: { kind: string; items: string[] }[] };
  const [rec, setRec] = useState<Rec | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const runRec = async () => {
    setBusy(true);
    try {
      setRec(await api<Rec>("/api/admin/payments/reconcile", { method: "POST" }));
    } catch (e) {
      setRec({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const { data } = useData(() => api<{ rows: R[]; total: number; page: number; size: number; providers: Prov[] }>(`/api/admin/payments?provider=${f.provider}&page=${f.page}`), [f.provider, f.page]);
  return (
    <>
      <PageHead
        title="Pagos"
        sub="Cobros y reembolsos en euros. Configura las pasarelas en Configuración → Pagos. Cada noche se comprueba que cada cobro tiene su pedido."
        actions={
          <Btn onClick={runRec} disabled={busy}>
            <Scale className="size-4" /> {busy ? "Comprobando…" : "Comprobar cobros ahora"}
          </Btn>
        }
      />
      {rec && (
        <div className={cx("mb-4 rounded-xl border px-4 py-3 text-sm", "error" in rec || rec.issues.length ? "border-red/30 bg-red/5" : "border-emerald-300 bg-emerald-50")}>
          {"error" in rec ? (
            rec.error
          ) : !rec.issues.length && !rec.fixed.length ? (
            <>Todo cuadra: cada cobro tiene su pedido{rec.checkedStripe ? ` (${rec.checkedStripe} cobros de Stripe revisados)` : ""}.</>
          ) : (
            <div className="space-y-2">
              {rec.fixed.length > 0 && (
                <div>
                  <b>Corregidos ({rec.fixed.length}):</b> pedidos marcados como pagados porque el aviso de Stripe no había llegado.
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">{rec.fixed.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              {rec.issues.map((i) => (
                <div key={i.kind}>
                  <b>{i.kind}:</b>
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">{i.items.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data?.providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-panel px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">{METHOD[p.id]}</span>
              <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold", p.enabled ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-500")}>{p.enabled ? "Activo" : "Inactivo"}</span>
            </div>
            <div className="mt-1 font-display text-lg font-bold tabular-nums">{eur(p.paid)}</div>
            <div className="text-[11px] text-muted">30 días · reembolsado {eur(p.refunded)}</div>
          </div>
        ))}
      </div>
      <Card
        actions={
          <select className={inputCls + " h-8 w-40"} value={f.provider} onChange={(e) => setF({ provider: e.target.value, page: 1 })} aria-label="Método">
            <option value="">Todos</option>
            {Object.entries(METHOD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        }
        title="Movimientos"
      >
        {data && !data.rows.length ? (
          <Empty>Sin pagos todavía.</Empty>
        ) : (
          <Table head={["Fecha", "Pedido", "Método", "Referencia", "Estado", "Importe"]}>
            {data?.rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-muted">{dt(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <a href={`/admin/pedidos?id=${r.orderId}`} className="font-mono font-bold hover:text-gold-ink">
                    {r.code}
                  </a>
                  <div className="text-xs text-muted">{r.customerName}</div>
                </td>
                <td className="px-4 py-2.5">{METHOD[r.provider]}</td>
                <td className="max-w-48 truncate px-4 py-2.5 font-mono text-xs text-muted">{r.providerRef}</td>
                <td className="px-4 py-2.5">
                  <PayBadge s={r.status} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {eur(r.amountCents)}
                  {r.refundedCents > 0 && <div className="text-xs text-violet-700">−{eur(r.refundedCents)}</div>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={data.page} total={data.total} size={data.size} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Card>
    </>
  );
}
