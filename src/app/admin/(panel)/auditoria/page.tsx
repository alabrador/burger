"use client";

import { useState } from "react";
import { api, dt } from "../../_lib/api";
import { Card, inputCls, PageHead, Pager, Table, useData } from "../../_lib/ui";

type A = { id: number; userEmail: string | null; action: string; entity: string | null; entityId: string | null; data: unknown; ip: string | null; createdAt: string };

export default function Auditoria() {
  const [f, setF] = useState({ action: "", page: 1 });
  const { data } = useData(() => api<{ rows: A[]; total: number; page: number; size: number }>(`/api/admin/audit?page=${f.page}&action=${encodeURIComponent(f.action)}`), [f.page, f.action]);
  return (
    <>
      <PageHead title="Auditoría" sub="Registro de accesos y cambios hechos en el panel" />
      <Card
        actions={
          <select className={inputCls + " h-8 w-48"} value={f.action} onChange={(e) => setF({ action: e.target.value, page: 1 })} aria-label="Filtrar">
            <option value="">Todo</option>
            <option value="login">Accesos</option>
            <option value="order">Pedidos</option>
            <option value="product">Productos</option>
            <option value="settings">Configuración</option>
            <option value="user">Usuarios</option>
            <option value="customer">Clientes</option>
            <option value="coupon">Cupones</option>
          </select>
        }
        title="Eventos"
      >
        <Table head={["Fecha", "Usuario", "Acción", "Objeto", "IP", "Detalle"]}>
          {data?.rows.map((r) => (
            <tr key={r.id} className={r.action === "login.failed" ? "bg-red/5" : ""}>
              <td className="px-4 py-2 text-xs whitespace-nowrap text-muted">{dt(r.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
              <td className="px-4 py-2 text-xs">{r.userEmail ?? "—"}</td>
              <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted">{r.entity ? `${r.entity}:${(r.entityId ?? "").slice(0, 12)}` : ""}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted">{r.ip}</td>
              <td className="max-w-72 truncate px-4 py-2 font-mono text-[11px] text-muted" title={r.data ? JSON.stringify(r.data) : ""}>
                {r.data ? JSON.stringify(r.data) : ""}
              </td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} total={data.total} size={data.size} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Card>
    </>
  );
}
