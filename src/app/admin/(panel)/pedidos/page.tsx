"use client";

import { Download, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api, dt, eur, hm, METHOD, STATUS } from "../../_lib/api";
import { OrderDetail } from "../../_lib/order-detail";
import { useMe } from "../../_lib/shell";
import { Btn, Card, cx, Drawer, Empty, inputCls, PageHead, Pager, PayBadge, StatusBadge, Table, useData } from "../../_lib/ui";

type Row = { id: string; code: string; status: string; paymentStatus: string; paymentMethod: string; customerName: string; customerEmail: string; totalCents: number; pickupAt: string; createdAt: string; items: number };

export default function Pedidos() {
  const me = useMe();
  const [f, setF] = useState({ status: "", method: "", q: "", from: "", to: "", page: 1 });
  const [q, setQ] = useState("");
  // el panel solo se pinta en el navegador (tras cargar la sesión), así que podemos leer la URL
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(location.search).get("id"));
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)])).toString();
  const { data, loading, reload } = useData(() => api<{ rows: Row[]; total: number; page: number; size: number }>(`/api/admin/orders?${qs}`), [qs]);

  useEffect(() => {
    const t = setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const t = setInterval(reload, 20_000);
    return () => clearInterval(t);
  }, [reload]);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v, page: 1 }));
  return (
    <>
      <PageHead
        title="Pedidos"
        sub="Busca, filtra y gestiona todos los pedidos"
        actions={
          <>
            <Btn onClick={reload} aria-label="Recargar">
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            </Btn>
            {me.perms.includes("payments.view") && (
              <a href={`/api/admin/orders/export?${qs}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-panel px-4 text-sm font-semibold hover:bg-panel-2">
                <Download className="size-4" /> CSV
              </a>
            )}
          </>
        }
      />
      <div className="admin-shadow mb-5 flex flex-wrap gap-2 rounded-2xl bg-char p-2.5" role="tablist" aria-label="Estado">
        {[["", "Todos"], ["active", "En curso"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={f.status === k} onClick={() => set("status", k)} className={cx("rounded-xl border px-3.5 py-2 text-sm font-semibold transition", f.status === k ? "border-white bg-white text-char" : "border-white/20 text-white/85 hover:border-white/50 hover:text-white")}>
            {l}
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
            <input className={inputCls + " pl-8"} placeholder="Código, nombre, correo o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </label>
          <select className={inputCls} value={f.method} onChange={(e) => set("method", e.target.value)} aria-label="Método de pago">
            <option value="">Todos los pagos</option>
            {Object.entries(METHOD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input type="date" className={inputCls} value={f.from} onChange={(e) => set("from", e.target.value)} aria-label="Desde" />
          <input type="date" className={inputCls} value={f.to} onChange={(e) => set("to", e.target.value)} aria-label="Hasta" />
        </div>
        {data && data.rows.length === 0 ? (
          <Empty>No hay pedidos con estos filtros.</Empty>
        ) : (
          <Table head={["Código", "Cliente", "Estado", "Pago", "Recogida", "Total", "Creado"]}>
            {data?.rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-panel-2" onClick={() => setOpen(r.id)}>
                <td className="px-4 py-2.5 font-mono font-bold tracking-wider">{r.code}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.customerName}</div>
                  <div className="text-xs text-muted">{r.items} burger{r.items === 1 ? "" : "s"}</div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge s={r.status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-xs">{METHOD[r.paymentMethod]}</div>
                  <PayBadge s={r.paymentStatus} />
                </td>
                <td className="px-4 py-2.5 tabular-nums">{hm(r.pickupAt)}</td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{eur(r.totalCents)}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{dt(r.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={data.page} total={data.total} size={data.size} noun="pedidos" onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Detalle del pedido" wide>
        {open && <OrderDetail id={open} onChange={reload} />}
      </Drawer>
    </>
  );
}
