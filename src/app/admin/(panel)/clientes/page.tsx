"use client";

import { Search, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { api, dt, eur, METHOD } from "../../_lib/api";
import { useMe } from "../../_lib/shell";
import { Btn, Card, Drawer, Empty, inputCls, PageHead, Pager, StatusBadge, Table, useData, useToast } from "../../_lib/ui";

type C = { id: string; email: string; name: string; phone: string | null; ordersCount: number; totalSpentCents: number; lastOrderAt: string | null; createdAt: string; marketingOptIn: boolean; notes: string | null };

export default function Clientes() {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ q: "", sort: "recent", page: 1 });
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ ...f, page: String(f.page) }).toString();
  const { data, reload } = useData(() => api<{ rows: C[]; total: number; page: number; size: number }>(`/api/admin/customers?${qs}`), [qs]);
  useEffect(() => {
    const t = setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <PageHead title="Clientes" sub="Se crean solos con cada pedido" />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
            <input className={inputCls + " pl-8"} placeholder="Nombre, correo o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </label>
          <select className={inputCls + " w-48"} value={f.sort} onChange={(e) => setF((x) => ({ ...x, sort: e.target.value, page: 1 }))} aria-label="Ordenar">
            <option value="recent">Último pedido</option>
            <option value="orders">Más pedidos</option>
            <option value="spent">Más gasto</option>
          </select>
        </div>
        {data && !data.rows.length ? (
          <Empty>Aún no hay clientes.</Empty>
        ) : (
          <Table head={["Cliente", "Teléfono", "Pedidos", "Gastado", "Último pedido", "Publicidad"]}>
            {data?.rows.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-panel-2" onClick={() => setOpen(c.id)}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted">{c.email}</div>
                </td>
                <td className="px-4 py-2.5 text-xs">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{c.ordersCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{eur(c.totalSpentCents)}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{dt(c.lastOrderAt)}</td>
                <td className="px-4 py-2.5 text-xs">{c.marketingOptIn ? "Sí" : "No"}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={data.page} total={data.total} size={data.size} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Cliente">
        {open && <Detail id={open} onDone={() => (setOpen(null), reload())} />}
      </Drawer>
    </>
  );
}

function Detail({ id, onDone }: { id: string; onDone: () => void }) {
  const me = useMe();
  const toast = useToast();
  const { data } = useData(() => api<{ customer: C; orders: { id: string; code: string; status: string; totalCents: number; createdAt: string; paymentMethod: string }[] }>(`/api/admin/customers/${id}`), [id]);
  const [notes, setNotes] = useState<string | null>(null);
  if (!data) return <p className="text-sm text-muted">Cargando…</p>;
  const c = data.customer;
  const anonymize = async () => {
    if (!confirm(`¿Anonimizar a ${c.name}? Se borran nombre, correo y teléfono de sus pedidos. No se puede deshacer.`)) return;
    try {
      await api(`/api/admin/customers/${id}`, { method: "DELETE" });
      toast("Cliente anonimizado");
      onDone();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-lg font-semibold">{c.name}</div>
        <div className="text-muted">
          {c.email}
          {c.phone && ` · ${c.phone}`}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span>{c.ordersCount} pedidos</span>
          <span>{eur(c.totalSpentCents)} gastado</span>
          <span>Cliente desde {dt(c.createdAt, { month: "short", year: "numeric" })}</span>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Notas internas</span>
        <textarea className={inputCls + " h-20 py-2"} defaultValue={c.notes ?? ""} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        {notes !== null && (
          <Btn
            size="sm"
            className="mt-1"
            onClick={() =>
              api(`/api/admin/customers/${id}`, { method: "PATCH", body: { notes: notes || null } })
                .then(() => (toast("Guardado"), setNotes(null)))
                .catch((e) => toast(e.message, "err"))
            }
          >
            Guardar nota
          </Btn>
        )}
      </label>
      <div>
        <h3 className="mb-2 text-xs text-muted">Pedidos</h3>
        <ul className="divide-y divide-line/60 rounded-lg border border-line">
          {data.orders.map((o) => (
            <li key={o.id}>
              <a href={`/admin/pedidos?id=${o.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-panel-2">
                <span className="font-mono font-bold">{o.code}</span>
                <StatusBadge s={o.status} />
                <span className="text-xs text-muted">{METHOD[o.paymentMethod]}</span>
                <span className="ml-auto tabular-nums">{eur(o.totalCents)}</span>
                <span className="text-xs text-muted">{dt(o.createdAt, { day: "2-digit", month: "2-digit" })}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {me.perms.includes("customers.delete") && (
        <Btn variant="danger" size="sm" onClick={anonymize}>
          <UserX className="size-4" /> Anonimizar (RGPD)
        </Btn>
      )}
    </div>
  );
}
