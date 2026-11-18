"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, dt, eur } from "../../_lib/api";
import { Btn, Card, Drawer, Empty, Field, inputCls, PageHead, Table, Toggle, useData, useToast } from "../../_lib/ui";

type C = { code: string; type: "percent" | "fixed"; value: number; minTotalCents: number; maxUses: number | null; usedCount: number; validFrom: string | null; validTo: string | null; active: boolean };

export default function Cupones() {
  const toast = useToast();
  const { data, reload } = useData(() => api<C[]>("/api/admin/coupons"));
  const [open, setOpen] = useState(false);
  const patch = (c: C, body: Partial<C>) =>
    api(`/api/admin/coupons/${c.code}`, { method: "PATCH", body })
      .then(reload)
      .catch((e) => toast(e.message, "err"));
  const del = async (c: C) => {
    if (!confirm(`¿Eliminar el cupón ${c.code}?`)) return;
    const r = await api<{ deactivated: boolean }>(`/api/admin/coupons/${c.code}`, { method: "DELETE" }).catch((e) => (toast(e.message, "err"), null));
    if (r) toast(r.deactivated ? "Ya se había usado: queda desactivado" : "Eliminado");
    reload();
  };
  return (
    <>
      <PageHead
        title="Cupones"
        sub="Descuentos por código en el checkout"
        actions={
          <Btn variant="gold" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nuevo cupón
          </Btn>
        }
      />
      <Card>
        {data && !data.length ? (
          <Empty>No hay cupones. Crea el primero.</Empty>
        ) : (
          <Table head={["Código", "Descuento", "Mínimo", "Usos", "Validez", "Activo", ""]}>
            {data?.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-2.5 font-mono font-bold">{c.code}</td>
                <td className="px-4 py-2.5">{c.type === "percent" ? `${c.value} %` : eur(c.value)}</td>
                <td className="px-4 py-2.5">{c.minTotalCents ? eur(c.minTotalCents) : "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {c.usedCount}
                  {c.maxUses ? ` / ${c.maxUses}` : ""}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {c.validFrom || c.validTo ? `${dt(c.validFrom, { day: "2-digit", month: "2-digit" })} – ${dt(c.validTo, { day: "2-digit", month: "2-digit" })}` : "Siempre"}
                </td>
                <td className="px-4 py-2.5">
                  <Toggle checked={c.active} onChange={(v) => patch(c, { active: v })} label={`Activar ${c.code}`} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => del(c)} aria-label={`Eliminar ${c.code}`} className="text-muted hover:text-red-700">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Drawer open={open} onClose={() => setOpen(false)} title="Nuevo cupón">
        <New onDone={() => (setOpen(false), reload())} />
      </Drawer>
    </>
  );
}

function New({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ code: "", type: "percent", value: "10", min: "", maxUses: "", from: "", to: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = (s: string) => Math.round(Number(s.replace(",", ".")) * 100);
    try {
      await api("/api/admin/coupons", {
        method: "POST",
        body: {
          code: f.code,
          type: f.type,
          value: f.type === "percent" ? Number(f.value) : cents(f.value),
          minTotalCents: f.min ? cents(f.min) : 0,
          maxUses: f.maxUses ? Number(f.maxUses) : null,
          validFrom: f.from ? new Date(f.from).toISOString() : null,
          validTo: f.to ? new Date(f.to).toISOString() : null,
        },
      });
      toast("Cupón creado");
      onDone();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field label="Código">
        <input className={inputCls + " font-mono uppercase"} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} required minLength={3} maxLength={32} placeholder="BIENVENIDA10" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tipo">
          <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="percent">Porcentaje</option>
            <option value="fixed">Importe fijo (€)</option>
          </select>
        </Field>
        <Field label={f.type === "percent" ? "Descuento (%)" : "Descuento (€)"}>
          <input className={inputCls} inputMode="decimal" value={f.value} onChange={(e) => set("value", e.target.value)} required />
        </Field>
        <Field label="Pedido mínimo (€)">
          <input className={inputCls} inputMode="decimal" value={f.min} onChange={(e) => set("min", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Usos máximos">
          <input className={inputCls} type="number" min={1} value={f.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="Sin límite" />
        </Field>
        <Field label="Desde">
          <input className={inputCls} type="datetime-local" value={f.from} onChange={(e) => set("from", e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input className={inputCls} type="datetime-local" value={f.to} onChange={(e) => set("to", e.target.value)} />
        </Field>
      </div>
      <Btn variant="gold" className="w-full">
        Crear cupón
      </Btn>
    </form>
  );
}
