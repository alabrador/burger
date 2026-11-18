"use client";

import { useState } from "react";
import { api, eur, METHOD, STATUS } from "../_lib/api";
import { Card, cx, PageHead, useData } from "../_lib/ui";

type Dash = {
  kpi: { orders: number; revenue: number; refunds: number; avg: number; cancelled: number; customers: number };
  live: { status: string; n: number }[];
  series: { bucket: string; orders: number; revenue: number }[];
  methods: { method: string; n: number; revenue: number }[];
  proteins: { id: string; n: number }[];
  ingredients: { id: string; n: number }[];
  prepMinutes: number;
};
type P = { id: string; name: string };
const RANGES = [
  ["today", "Hoy"],
  ["7d", "7 días"],
  ["30d", "30 días"],
] as const;

export default function Dashboard() {
  const [range, setRange] = useState<string>("today");
  const { data: d, error } = useData(() => api<Dash>(`/api/admin/dashboard?range=${range}`), [range]);
  const { data: products } = useData(() => api<P[]>("/api/admin/products"));
  const name = (id: string) => products?.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      <PageHead
        title="Resumen"
        sub="Ventas y actividad del local"
        actions={
          <div className="flex rounded-lg border border-line bg-panel p-0.5" role="tablist">
            {RANGES.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx("rounded-md px-3 py-1 text-xs font-semibold", range === k ? "bg-gold text-[#1b1208]" : "text-muted hover:text-ink")}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Ventas" value={d ? eur(d.kpi.revenue) : "…"} />
        <Stat label="Pedidos" value={d?.kpi.orders ?? "…"} />
        <Stat label="Ticket medio" value={d ? eur(d.kpi.avg) : "…"} />
        <Stat label="Tiempo de preparación" value={d ? `${d.prepMinutes} min` : "…"} />
        <Stat label="Clientes nuevos" value={d?.kpi.customers ?? "…"} />
        <Stat label="Cancelados / reembolsos" value={d ? `${d.kpi.cancelled} · ${eur(d.kpi.refunds)}` : "…"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title={range === "today" ? "Ventas por hora (hoy)" : "Ventas por día"} className="xl:col-span-2">
          {d && <Bars data={d.series} hourly={range === "today"}  />}
        </Card>
        <Card title="Ahora mismo">
          <ul className="space-y-2">
            {["confirmed", "preparing", "ready", "pending_payment"].map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="text-muted">{STATUS[s].label}</span>
                <span className="font-display text-lg font-bold tabular-nums">{d?.live.find((x) => x.status === s)?.n ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="Métodos de pago">
          <Rank rows={(d?.methods ?? []).map((m) => ({ label: METHOD[m.method] ?? m.method, n: m.n, sub: eur(m.revenue) }))} />
        </Card>
        <Card title="Proteínas">
          <Rank rows={(d?.proteins ?? []).map((m) => ({ label: name(m.id), n: m.n }))} />
        </Card>
        <Card title="Ingredientes más pedidos">
          <Rank rows={(d?.ingredients ?? []).map((m) => ({ label: name(m.id), n: m.n }))} />
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

/** Barras de una sola serie (ventas), con tooltip al pasar el ratón. */
function Bars({ data: raw, hourly }: { data: Dash["series"]; hourly: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!raw.some((d) => d.orders)) return <p className="py-12 text-center text-sm text-muted">Sin ventas en este periodo.</p>;
  const data = raw;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const lab = (b: string) => (hourly ? `${b}:00` : new Date(b).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }));
  return (
    <div className="relative">
      <div className="flex h-48 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.bucket} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div className={cx("mx-auto w-full max-w-10 rounded-t-[4px] transition", hover === i ? "bg-gold" : "bg-gold/70")} style={{ height: d.revenue ? `${Math.max(2, (d.revenue / max) * 100)}%` : "2px", opacity: d.revenue ? 1 : 0.35 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{lab(data[0].bucket)}</span>
        <span>{lab(data[data.length - 1].bucket)}</span>
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs shadow-lg" style={{ left: `min(calc(${((hover + 0.5) / data.length) * 100}% ), calc(100% - 9rem))` }}>
          <div className="font-semibold">{lab(data[hover].bucket)}</div>
          <div>{eur(data[hover].revenue)}</div>
          <div className="text-muted">{data[hover].orders} pedidos</div>
        </div>
      )}
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.bucket}>
              <td>{lab(d.bucket)}</td>
              <td>{eur(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ rows }: { rows: { label: string; n: number; sub?: string }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Sin datos.</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{r.label}</span>
            <span className="text-muted tabular-nums">
              {r.n}
              {r.sub ? ` · ${r.sub}` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-line/60">
            <div className="h-full rounded-full bg-gold/80" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
