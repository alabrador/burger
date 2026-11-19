"use client";

import { CheckCheck, CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api, ago, dt } from "../../_lib/api";
import { Btn, Card, cx, Drawer, Empty, inputCls, PageHead, Pager, Table, useData, useToast } from "../../_lib/ui";

type E = {
  id: number;
  source: string;
  level: string;
  message: string;
  detail: string | null;
  path: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
  alertedAt: string | null;
  resolvedAt: string | null;
};

const SRC: Record<string, string> = {
  api: "Servidor",
  render: "Página",
  client: "Navegador",
  payment: "Pagos",
  webhook: "Webhook",
  mail: "Correo",
  cron: "Tareas",
};

export default function Errores() {
  const toast = useToast();
  const [f, setF] = useState({ status: "open", page: 1 });
  const [sel, setSel] = useState<E | null>(null);
  const { data, reload } = useData(() => api<{ rows: E[]; total: number; page: number; size: number }>(`/api/admin/errors?status=${f.status}&page=${f.page}`), [f.status, f.page]);

  const resolve = async (b: { ids?: number[]; all?: boolean; reopen?: boolean }) => {
    try {
      const r = await api<{ updated: number }>("/api/admin/errors", { method: "PATCH", body: b });
      toast(b.reopen ? "Reabierto" : r.updated === 1 ? "Marcado como resuelto" : `${r.updated} marcados como resueltos`);
      setSel(null);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <>
      <PageHead
        title="Errores"
        sub="Fallos de la web, los pagos y los correos, agrupados por causa. Te avisamos por correo como mucho una vez por hora de cada uno."
        actions={
          f.status === "open" && data?.total ? (
            <Btn onClick={() => resolve({ all: true })}>
              <CheckCheck className="size-4" /> Marcar todo resuelto
            </Btn>
          ) : null
        }
      />
      <Card
        title={f.status === "open" ? "Sin resolver" : f.status === "resolved" ? "Resueltos" : "Todos"}
        actions={
          <select className={inputCls + " h-8 w-40"} value={f.status} onChange={(e) => setF({ status: e.target.value, page: 1 })} aria-label="Filtrar">
            <option value="open">Sin resolver</option>
            <option value="resolved">Resueltos</option>
            <option value="all">Todos</option>
          </select>
        }
      >
        {data && !data.rows.length ? (
          <Empty icon={<CircleCheck className="size-8" />}>{f.status === "open" ? "Todo en orden: no hay errores pendientes." : "No hay errores."}</Empty>
        ) : (
          <Table head={["Último", "Origen", "Error", "Veces", ""]}>
            {data?.rows.map((r) => (
              <tr key={r.id} className={cx("cursor-pointer hover:bg-panel-2", r.level === "error" && !r.resolvedAt && "bg-red/[0.03]")} onClick={() => setSel(r)}>
                <td className="text-xs whitespace-nowrap text-muted" title={dt(r.lastAt)}>
                  {ago(r.lastAt)}
                </td>
                <td className="text-xs whitespace-nowrap">
                  <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", r.level === "error" ? "bg-red/10 text-red" : "bg-amber-100 text-amber-800")}>
                    <TriangleAlert className="size-3" /> {SRC[r.source] ?? r.source}
                  </span>
                </td>
                <td className="max-w-[520px]">
                  <div className="truncate font-mono text-xs">{r.message}</div>
                  {r.path && <div className="truncate text-[11px] text-muted">{r.path}</div>}
                </td>
                <td className="text-right font-semibold tabular-nums">{r.count}</td>
                <td className="text-right">
                  {!r.resolvedAt && (
                    <Btn
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resolve({ ids: [r.id] });
                      }}
                    >
                      Resuelto
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.total > data.size && <Pager page={data.page} total={data.total} size={data.size} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title="Detalle del error" wide>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info k="Origen" v={SRC[sel.source] ?? sel.source} />
              <Info k="Veces" v={String(sel.count)} />
              <Info k="Primera vez" v={dt(sel.firstAt)} />
              <Info k="Última vez" v={dt(sel.lastAt)} />
              <Info k="Aviso por correo" v={sel.alertedAt ? dt(sel.alertedAt) : "—"} />
              <Info k="Estado" v={sel.resolvedAt ? `Resuelto ${dt(sel.resolvedAt)}` : "Sin resolver"} />
            </div>
            {sel.path && <Info k="Dónde" v={sel.path} mono />}
            <Info k="Mensaje" v={sel.message} mono />
            {sel.detail && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted">Detalle técnico</div>
                <pre className="max-h-80 overflow-auto rounded-xl bg-panel-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">{sel.detail}</pre>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {sel.resolvedAt ? (
                <Btn onClick={() => resolve({ ids: [sel.id], reopen: true })}>Reabrir</Btn>
              ) : (
                <Btn variant="gold" onClick={() => resolve({ ids: [sel.id] })}>
                  Marcar como resuelto
                </Btn>
              )}
            </div>
            <p className="text-xs text-muted">Si vuelve a ocurrir después de marcarlo como resuelto, aparecerá de nuevo como pendiente.</p>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted">{k}</div>
      <div className={cx("break-words", mono && "font-mono text-xs")}>{v}</div>
    </div>
  );
}
