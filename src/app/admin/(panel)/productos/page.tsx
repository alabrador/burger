"use client";

import { useState } from "react";
import { api, eur } from "../../_lib/api";
import { useMe } from "../../_lib/shell";
import { Btn, Card, cx, Drawer, Field, inputCls, PageHead, Toggle, useData, useToast } from "../../_lib/ui";

type P = { id: string; kind: string; category: string; name: string; description: string | null; priceCents: number; grams: number; kcal: number; maxQty: number; allergens: string[]; active: boolean; soldOut: boolean };
const CAT: Record<string, string> = { base: "Base del combo", carne: "Proteínas y carne", quesos: "Quesos", vegetales: "Vegetales", salsas: "Salsas", extras: "Extras", bebidas: "Bebidas" };
const THUMBS = new Set("bacon bbq bun caramel cheddar crispy egg grilled house jalapeno ketchup lettuce mustard onion patty pickles swiss tomato".split(" "));
const thumb = (id: string) => {
  const t = ({ angus: "patty", patty_x: "patty", burger: "bun" } as Record<string, string>)[id] ?? id;
  return THUMBS.has(t) ? `/thumbs/${t}.webp` : null;
};
const ALLERGENS = ["gluten", "crustáceos", "huevo", "pescado", "cacahuetes", "soja", "leche", "frutos de cáscara", "apio", "mostaza", "sésamo", "sulfitos", "altramuces", "moluscos"];

export default function Productos() {
  const me = useMe();
  const toast = useToast();
  const edit = ["owner", "admin", "manager"].includes(me.role);
  const { data, setData } = useData(() => api<P[]>("/api/admin/products"));
  const [open, setOpen] = useState<P | null>(null);

  const save = async (id: string, patch: Partial<P>) => {
    try {
      const p = await api<P>(`/api/admin/products/${id}`, { method: "PATCH", body: patch });
      setData((l) => l?.map((x) => (x.id === id ? p : x)) ?? null);
      toast("Guardado");
      return true;
    } catch (e) {
      toast((e as Error).message, "err");
      return false;
    }
  };

  const groups = Object.keys(CAT).map((c) => ({ c, items: (data ?? []).filter((p) => p.category === c) })).filter((g) => g.items.length);
  return (
    <>
      <PageHead title="Productos" sub="Precios, disponibilidad y alérgenos. Los cambios se aplican al momento en la web." />
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.c} title={CAT[g.c]}>
            <ul className="divide-y divide-line/60">
              {g.items.map((p) => (
                <li key={p.id} className={cx("flex items-center gap-3 py-2.5", !p.active && "opacity-50")}>
                  {thumb(p.id) ? <img src={thumb(p.id)!} alt="" className="size-9 rounded-md bg-panel-2 object-contain" /> : <span className="size-9 rounded-md bg-panel-2" />}
                  <button className="min-w-0 flex-1 text-left" onClick={() => edit && setOpen(p)} disabled={!edit}>
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted">{p.allergens.length ? `Alérgenos: ${p.allergens.join(", ")}` : (p.description ?? "")}</div>
                  </button>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">{p.kind === "protein" && p.priceCents === 0 ? "Incluido" : eur(p.priceCents)}</span>
                  <Toggle checked={!p.soldOut} onChange={(v) => save(p.id, { soldOut: !v })} label={p.soldOut ? "Agotado" : "Hay"} disabled={p.id === "burger"} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && <Editor p={open} onSave={async (patch) => (await save(open.id, patch)) && setOpen(null)} />}
      </Drawer>
    </>
  );
}

function Editor({ p, onSave }: { p: P; onSave: (patch: Partial<P>) => void }) {
  const [f, setF] = useState({ ...p, price: (p.priceCents / 100).toFixed(2) });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = Math.round(Number(f.price.replace(",", ".")) * 100);
        if (!Number.isFinite(cents) || cents < 0) return;
        onSave({ name: f.name, description: f.description || null, priceCents: cents, grams: f.grams, kcal: f.kcal, maxQty: f.maxQty, allergens: f.allergens, active: f.active });
      }}
    >
      <Field label="Nombre">
        <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={60} />
      </Field>
      <Field label="Descripción">
        <input className={inputCls} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={160} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label={p.kind === "protein" ? "Suplemento (€)" : "Precio (€)"}>
          <input className={inputCls} inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} required pattern="\d+([.,]\d{1,2})?" />
        </Field>
        <Field label="Gramos">
          <input className={inputCls} type="number" min={0} value={f.grams} onChange={(e) => set("grams", Number(e.target.value))} />
        </Field>
        <Field label="Kcal">
          <input className={inputCls} type="number" min={0} value={f.kcal} onChange={(e) => set("kcal", Number(e.target.value))} />
        </Field>
      </div>
      {p.kind === "ingredient" && (
        <Field label="Cantidad máxima por hamburguesa">
          <input className={inputCls} type="number" min={1} max={5} value={f.maxQty} onChange={(e) => set("maxQty", Number(e.target.value))} />
        </Field>
      )}
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted">Alérgenos (14 del Reglamento UE 1169/2011)</legend>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const on = f.allergens.includes(a);
            return (
              <button type="button" key={a} onClick={() => set("allergens", on ? f.allergens.filter((x) => x !== a) : [...f.allergens, a])} className={cx("rounded-full border px-2.5 py-1 text-xs", on ? "border-gold bg-gold/15 text-gold" : "border-line text-muted")}>
                {a}
              </button>
            );
          })}
        </div>
      </fieldset>
      {p.id !== "burger" && <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible en la carta" />}
      <Btn variant="gold" className="w-full">
        Guardar
      </Btn>
    </form>
  );
}
