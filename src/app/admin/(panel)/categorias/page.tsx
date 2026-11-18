"use client";

import { ArrowDown, ArrowUp, Check, Lock, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../_lib/api";
import { Btn, Card, cx, inputCls, PageHead, Table, Toggle, useData, useToast } from "../../_lib/ui";

type Cat = { id: string; name: string; sort: number; active: boolean; locked: boolean; products: number };

export default function Categorias() {
  const toast = useToast();
  const { data, setData, reload } = useData(() => api<Cat[]>("/api/admin/categories"));
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const list = data ?? [];

  const run = async <T,>(fn: () => Promise<T>, ok: string) => {
    try {
      const r = await fn();
      toast(ok);
      return r;
    } catch (e) {
      toast((e as Error).message, "err");
      return null;
    }
  };
  const patch = (id: string, body: Partial<Cat>) => run(() => api<Cat>(`/api/admin/categories/${id}`, { method: "PATCH", body }), "Guardado");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = await run(() => api<Cat>("/api/admin/categories", { method: "POST", body: { name } }), "Categoría creada");
    if (c) {
      setName("");
      setData((l) => [...(l ?? []), c]);
    }
  };

  /** Intercambia el orden con la vecina y guarda las dos. */
  const move = async (i: number, d: -1 | 1) => {
    const a = list[i];
    const b = list[i + d];
    if (!a || !b) return;
    const next = [...list];
    next[i] = { ...b, sort: a.sort };
    next[i + d] = { ...a, sort: b.sort };
    setData(next);
    const ok = (await patch(a.id, { sort: b.sort })) && (await patch(b.id, { sort: a.sort }));
    if (!ok) reload();
  };

  const remove = async (c: Cat) => {
    if (!window.confirm(`¿Borrar la categoría «${c.name}»?`)) return;
    const r = await run(() => api(`/api/admin/categories/${c.id}`, { method: "DELETE" }), "Categoría borrada");
    if (r) setData((l) => l?.filter((x) => x.id !== c.id) ?? null);
  };

  return (
    <>
      <PageHead title="Categorías" sub="Agrupan los ingredientes en la web, en el orden que elijas." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card flush>
          <Table flush head={["Orden", "Nombre", "Productos", "Visible", ""]}>
            {list.map((c, i) => (
              <tr key={c.id} className="transition hover:bg-panel-2">
                <td className="w-24">
                  <div className="flex gap-1">
                    <button aria-label={`Subir ${c.name}`} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-panel disabled:opacity-30">
                      <ArrowUp className="size-4" />
                    </button>
                    <button aria-label={`Bajar ${c.name}`} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-panel disabled:opacity-30">
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                </td>
                <td>
                  {editing?.id === c.id ? (
                    <form
                      className="flex max-w-sm gap-1.5"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const r = await patch(c.id, { name: editing.name });
                        if (r) {
                          setData((l) => l?.map((x) => (x.id === c.id ? { ...x, name: r.name } : x)) ?? null);
                          setEditing(null);
                        }
                      }}
                    >
                      <input className={inputCls + " h-9"} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} minLength={2} maxLength={40} required autoFocus aria-label="Nombre" />
                      <button aria-label="Guardar" className="grid size-9 shrink-0 place-items-center rounded-lg bg-char text-white">
                        <Check className="size-4" />
                      </button>
                      <button type="button" aria-label="Cancelar" onClick={() => setEditing(null)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted">
                        <X className="size-4" />
                      </button>
                    </form>
                  ) : (
                    <span className="flex items-center gap-2 font-semibold">
                      {c.name}
                      {c.locked && (
                        <span title="Categoría fija" className="text-muted">
                          <Lock className="size-3.5" />
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td>
                  <Link href={`/admin/productos`} className="inline-flex min-w-8 justify-center rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ring-line">
                    {c.products}
                  </Link>
                </td>
                <td>
                  <Toggle
                    checked={c.active}
                    disabled={c.id === "base" || c.id === "carne"}
                    onChange={async (v) => {
                      const r = await patch(c.id, { active: v });
                      if (r) setData((l) => l?.map((x) => (x.id === c.id ? { ...x, active: v } : x)) ?? null);
                    }}
                    label={`${c.name} visible`}
                    hideLabel
                  />
                </td>
                <td className="w-28 text-right">
                  <div className="flex justify-end gap-1">
                    <button aria-label={`Renombrar ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-gold/15 hover:text-gold-ink">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label={`Borrar ${c.name}`}
                      disabled={c.locked || c.products > 0}
                      title={c.locked ? "Categoría fija" : c.products ? "Tiene productos" : "Borrar"}
                      onClick={() => remove(c)}
                      className={cx("grid size-9 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red-700 disabled:opacity-30 disabled:hover:bg-transparent")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Nueva categoría" sub="Luego añade ingredientes en Productos" icon={<Tags className="size-4" />}>
          <form onSubmit={add} className="space-y-3">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Quesos especiales" minLength={2} maxLength={40} required aria-label="Nombre de la categoría" />
            <Btn variant="gold" className="w-full">
              <Plus className="size-4" strokeWidth={2.5} /> Crear categoría
            </Btn>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted">Base, Carne y Bebidas son fijas. Una categoría solo se puede borrar cuando no tiene productos; ocultarla la quita de la web sin perder nada.</p>
        </Card>
      </div>
    </>
  );
}
