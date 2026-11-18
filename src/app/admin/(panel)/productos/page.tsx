"use client";

import { ImagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { MODELS } from "@/lib/models";
import { api, eur } from "../../_lib/api";
import { useMe } from "../../_lib/shell";
import { Btn, Card, cx, Drawer, Empty, Field, inputCls, PageHead, Table, Toggle, useData, useToast } from "../../_lib/ui";

type P = {
  id: string;
  kind: "base" | "protein" | "ingredient" | "drink";
  category: string;
  name: string;
  description: string | null;
  priceCents: number;
  grams: number;
  kcal: number;
  maxQty: number;
  allergens: string[];
  active: boolean;
  soldOut: boolean;
  sort: number;
  model: string | null;
  swatch: string;
  imageV: number;
  custom: boolean;
};
type Cat = { id: string; name: string; sort: number; active: boolean; locked: boolean; products: number };

const KIND: Record<P["kind"], string> = { base: "Base", protein: "Proteína", ingredient: "Ingrediente", drink: "Bebida" };
const ALLERGENS = ["gluten", "crustáceos", "huevo", "pescado", "cacahuetes", "soja", "leche", "frutos de cáscara", "apio", "mostaza", "sésamo", "sulfitos", "altramuces", "moluscos"];
const MODEL_LABEL: Record<string, string> = {
  patty: "Carne Angus",
  grilled: "Pollo a la plancha",
  crispy: "Pollo crispy",
  cheddar: "Loncha de cheddar",
  swiss: "Loncha de queso suizo",
  lettuce: "Hoja de lechuga",
  tomato: "Rodajas de tomate",
  onion: "Aros de cebolla morada",
  caramel: "Cebolla caramelizada",
  pickles: "Pepinillos",
  jalapeno: "Jalapeños",
  bacon: "Tiras de tocino",
  egg: "Huevo frito",
  house: "Salsa clara (de la casa)",
  ketchup: "Salsa roja (kétchup)",
  mustard: "Salsa amarilla (mostaza)",
  bbq: "Salsa oscura (BBQ)",
};
const LAYER_MODELS = Object.keys(MODELS).filter((k) => !k.startsWith("bun_"));
const THUMBS = new Set("bacon bbq bun caramel cheddar crispy egg grilled house jalapeno ketchup lettuce mustard onion patty pickles swiss tomato".split(" "));

/** Foto del producto: la subida en el admin, o la miniatura del modelo 3D. */
function imgOf(p: Pick<P, "id" | "imageV" | "model">) {
  if (p.imageV) return `/api/catalog/img/${p.id}?v=${p.imageV}`;
  const t = ({ angus: "patty", patty_x: "patty", burger: "bun" } as Record<string, string>)[p.id] ?? (THUMBS.has(p.id) ? p.id : p.model);
  return t && THUMBS.has(t) ? `/thumbs/${t}.webp` : null;
}

function Thumb({ p, size = "size-11" }: { p: Pick<P, "id" | "imageV" | "model" | "swatch">; size?: string }) {
  const src = imgOf(p);
  return (
    <span className={cx("grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel-2", size)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- miniaturas pequeñas, ya optimizadas */}
      {src ? <img src={src} alt="" className="size-full object-contain p-0.5" /> : <span className="size-1/2 rounded-full" style={{ background: p.swatch }} />}
    </span>
  );
}

type Sort = "sort" | "name" | "price" | "category";

export default function Productos() {
  const me = useMe();
  const toast = useToast();
  const edit = me.perms.includes("products.edit");
  const { data, setData } = useData(() => api<P[]>("/api/admin/products"));
  const { data: cats } = useData(() => api<Cat[]>("/api/admin/categories"));
  const [open, setOpen] = useState<P | "new" | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<Sort>("sort");
  const [dir, setDir] = useState<1 | -1>(1);

  const catName = (id: string) => cats?.find((c) => c.id === id)?.name ?? id;
  const catOrder = (id: string) => cats?.find((c) => c.id === id)?.sort ?? 99;

  const rows = useMemo(() => {
    const term = q
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    const list = (data ?? []).filter(
      (p) =>
        (!term || norm(`${p.name} ${p.description ?? ""} ${p.id}`).includes(term)) &&
        (!cat || p.category === cat) &&
        (!state || (state === "active" ? p.active && !p.soldOut : state === "hidden" ? !p.active : p.soldOut)),
    );
    const key = (p: P): string | number => (sort === "name" ? p.name.toLowerCase() : sort === "price" ? p.priceCents : sort === "category" ? catOrder(p.category) * 1e5 + p.sort : catOrder(p.category) * 1e5 + p.sort);
    return list.sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- catOrder depende de cats
  }, [data, cats, q, cat, state, sort, dir]);

  const patch = async (id: string, body: Partial<P>) => {
    try {
      const p = await api<P>(`/api/admin/products/${id}`, { method: "PATCH", body });
      setData((l) => l?.map((x) => (x.id === id ? p : x)) ?? null);
      toast("Guardado");
      return p;
    } catch (e) {
      toast((e as Error).message, "err");
      return null;
    }
  };

  const stats = useMemo(() => {
    const l = data ?? [];
    return { total: l.length, active: l.filter((p) => p.active && !p.soldOut).length, out: l.filter((p) => p.soldOut).length, hidden: l.filter((p) => !p.active).length };
  }, [data]);

  return (
    <>
      <PageHead
        title="Productos"
        sub="Precios, ingredientes por categoría, fotos y disponibilidad. Los cambios salen al momento en la web."
        actions={
          edit && (
            <Btn variant="gold" onClick={() => setOpen("new")}>
              <Plus className="size-4" strokeWidth={2.5} /> Nuevo ingrediente
            </Btn>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="En la carta" value={stats.total} tone="char" onClick={() => setState("")} active={!state} />
        <Kpi label="Disponibles" value={stats.active} tone="ok" onClick={() => setState("active")} active={state === "active"} />
        <Kpi label="Agotados hoy" value={stats.out} tone="gold" onClick={() => setState("out")} active={state === "out"} />
        <Kpi label="Ocultos" value={stats.hidden} tone="red" onClick={() => setState("hidden")} active={state === "hidden"} />
      </div>

      <Card className="mb-5" title="Buscador de productos" sub="Por nombre, descripción o código" icon={<Search className="size-4" />}>
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted" />
            <input className={inputCls + " pl-9"} placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </label>
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {cats?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className={inputCls} value={state} onChange={(e) => setState(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="active">Disponibles</option>
            <option value="out">Agotados</option>
            <option value="hidden">Ocultos</option>
          </select>
          <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar por">
            <option value="sort">Orden de la carta</option>
            <option value="name">Nombre</option>
            <option value="price">Precio</option>
          </select>
          <select className={inputCls} value={dir} onChange={(e) => setDir(Number(e.target.value) as 1 | -1)} aria-label="Sentido">
            <option value={1}>Ascendente</option>
            <option value={-1}>Descendente</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-muted">
          {rows.length} producto{rows.length === 1 ? "" : "s"} encontrado{rows.length === 1 ? "" : "s"}
        </p>
      </Card>

      <Card flush>
        {data && rows.length === 0 ? (
          <Empty icon={<Search className="size-6" />}>No hay productos con estos filtros.</Empty>
        ) : (
          <Table flush head={["", "Nombre", "Categoría", "Precio", "Hay stock", "Estado", ""]}>
            {rows.map((p) => (
              <tr key={p.id} className={cx("transition hover:bg-panel-2", !p.active && "[&>td]:opacity-60")}>
                <td className="w-16 !pr-0">
                  <Thumb p={p} />
                </td>
                <td>
                  <button className="block max-w-[28rem] text-left disabled:cursor-default" onClick={() => edit && setOpen(p)} disabled={!edit}>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.description || (p.allergens.length ? `Alérgenos: ${p.allergens.join(", ")}` : KIND[p.kind])}</span>
                  </button>
                </td>
                <td className="whitespace-nowrap text-muted">
                  {catName(p.category)}
                  {p.kind !== "ingredient" && <span className="ml-1.5 rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-line">{KIND[p.kind]}</span>}
                </td>
                <td className="font-display text-[15px] font-extrabold whitespace-nowrap tabular-nums">
                  {p.kind === "protein" ? (p.priceCents ? `+${eur(p.priceCents)}` : <span className="font-sans text-sm font-semibold text-muted">Incluida</span>) : p.kind === "ingredient" && !p.priceCents ? <span className="font-sans text-sm font-semibold text-muted">Gratis</span> : p.kind === "ingredient" ? `+${eur(p.priceCents)}` : eur(p.priceCents)}
                </td>
                <td>
                  <Toggle checked={!p.soldOut} onChange={(v) => patch(p.id, { soldOut: !v })} label={p.soldOut ? `${p.name}: agotado` : `${p.name}: hay stock`} disabled={p.id === "burger"} hideLabel />
                </td>
                <td>
                  {!p.active ? (
                    <span className="inline-flex rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-500/25 ring-inset">Oculto</span>
                  ) : p.soldOut ? (
                    <span className="inline-flex rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-500/30 ring-inset">Agotado</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/30 ring-inset">Activo</span>
                  )}
                </td>
                <td className="w-12 text-right">
                  {edit && (
                    <button onClick={() => setOpen(p)} aria-label={`Editar ${p.name}`} className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-gold/15 hover:text-gold-ink">
                      <Pencil className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open === "new" ? "Nuevo ingrediente" : (open?.name ?? "")}>
        {open && cats && (
          <Editor
            key={open === "new" ? "new" : open.id}
            p={open === "new" ? null : open}
            cats={cats}
            onDone={(p, removed) => {
              setData((l) => (removed ? l?.filter((x) => x.id !== removed) : l?.some((x) => x.id === p!.id) ? l.map((x) => (x.id === p!.id ? p! : x)) : [...(l ?? []), p!]) ?? null);
              setOpen(null);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function Kpi({ label, value, tone, onClick, active }: { label: string; value: number; tone: "char" | "ok" | "gold" | "red"; onClick: () => void; active: boolean }) {
  const bar = { char: "bg-char", ok: "bg-emerald-500", gold: "bg-gold", red: "bg-red" }[tone];
  return (
    <button onClick={onClick} aria-pressed={active} className={cx("admin-shadow relative overflow-hidden rounded-2xl border bg-panel px-4 py-3.5 text-left transition hover:-translate-y-px", active ? "border-ink/30" : "border-line")}>
      <span className={cx("absolute inset-x-0 top-0 h-1", bar)} />
      <span className="block text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{label}</span>
      <span className="mt-1 block font-display text-2xl font-black tabular-nums">{value}</span>
    </button>
  );
}

/** Reduce la foto a 512 px y la pasa a WebP (o JPEG si el navegador no sabe) antes de subirla. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const webp = c.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.86);
}

function Editor({ p, cats, onDone }: { p: P | null; cats: Cat[]; onDone: (p: P | null, removedId?: string) => void }) {
  const toast = useToast();
  const isNew = !p;
  const kind = p?.kind ?? "ingredient";
  const ingredientCats = cats.filter((c) => c.id !== "base" && c.id !== "bebidas");
  const [f, setF] = useState({
    name: p?.name ?? "",
    description: p?.description ?? "",
    category: p?.category ?? ingredientCats.find((c) => c.id === "extras")?.id ?? ingredientCats[0]?.id ?? "",
    price: ((p?.priceCents ?? 0) / 100).toFixed(2),
    grams: p?.grams ?? 0,
    kcal: p?.kcal ?? 0,
    maxQty: p?.maxQty ?? 1,
    allergens: p?.allergens ?? [],
    active: p?.active ?? true,
    model: p?.model ?? "",
    swatch: p?.swatch ?? "#c9792e",
  });
  const [photo, setPhoto] = useState<string | null | undefined>(undefined); // undefined = sin cambios, null = quitar
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const preview = photo === undefined ? (p ? imgOf(p) : f.model && THUMBS.has(f.model) ? `/thumbs/${f.model}.webp` : null) : photo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(f.price.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast("Precio no válido", "err");
    setBusy(true);
    try {
      const body = {
        name: f.name,
        description: f.description || null,
        priceCents: cents,
        grams: Number(f.grams),
        kcal: Number(f.kcal),
        allergens: f.allergens,
        ...(kind === "ingredient" ? { category: f.category, maxQty: Number(f.maxQty), model: f.model || null, swatch: f.swatch } : {}),
        ...(p?.id !== "burger" ? { active: f.active } : {}),
      };
      let out = isNew ? await api<P>("/api/admin/products", { method: "POST", body }) : await api<P>(`/api/admin/products/${p.id}`, { method: "PATCH", body });
      if (photo) out = await api<P>(`/api/admin/products/${out.id}/image`, { method: "PUT", body: { data: photo } });
      else if (photo === null && p?.imageV) out = await api<P>(`/api/admin/products/${out.id}/image`, { method: "DELETE" });
      toast(isNew ? "Ingrediente creado" : "Guardado");
      onDone(out);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!p || !confirmDelete(p.name)) return;
    try {
      await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
      toast("Ingrediente borrado");
      onDone(null, p.id);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel-2 p-4">
        <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
          {preview ? <img src={preview} alt="" className="size-full object-contain p-1" /> : <span className="size-10 rounded-full" style={{ background: f.swatch }} />}
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold">Foto del producto</p>
          <p className="text-xs text-muted">JPG, PNG o WebP. Se recorta a 512 px. Sin foto se usa la miniatura del modelo 3D.</p>
          <div className="flex flex-wrap gap-2">
            <Btn type="button" size="sm" onClick={() => file.current?.click()}>
              <ImagePlus className="size-3.5" /> {preview ? "Cambiar" : "Subir foto"}
            </Btn>
            {(photo || (photo === undefined && p?.imageV)) && (
              <Btn type="button" size="sm" onClick={() => setPhoto(null)}>
                Quitar
              </Btn>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const fl = e.target.files?.[0];
              e.target.value = "";
              if (!fl) return;
              if (fl.size > 15 * 1024 * 1024) return toast("La imagen pesa más de 15 MB", "err");
              try {
                setPhoto(await shrink(fl));
              } catch {
                toast("No se pudo leer la imagen", "err");
              }
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={60} placeholder="Ej.: Queso de cabra" autoFocus={isNew} />
        </Field>
        <Field label="Descripción corta" className="sm:col-span-2" hint="Se ve bajo el nombre en la web.">
          <input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={160} placeholder="Ej.: Rulo de cabra a la plancha" />
        </Field>
        {kind === "ingredient" ? (
          <Field label="Categoría">
            <select className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)} required>
              {ingredientCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.active ? " (oculta)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Tipo">
            <input className={inputCls + " bg-panel-2 text-muted"} value={KIND[kind]} disabled />
          </Field>
        )}
        <Field label={kind === "protein" ? "Suplemento (€)" : kind === "ingredient" ? "Precio extra (€)" : "Precio (€)"} hint={kind === "base" ? "Pan brioche + papas, IVA incluido" : kind === "ingredient" ? "0 = gratis" : "IVA incluido"}>
          <div className="relative">
            <input className={inputCls + " pr-8 font-semibold tabular-nums"} inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} required pattern="\d+([.,]\d{1,2})?" />
            <span className="pointer-events-none absolute top-2.5 right-3 text-sm text-muted">€</span>
          </div>
        </Field>
        <Field label="Gramos">
          <input className={inputCls} type="number" min={0} max={5000} value={f.grams} onChange={(e) => set("grams", Number(e.target.value))} />
        </Field>
        <Field label="Kcal">
          <input className={inputCls} type="number" min={0} max={5000} value={f.kcal} onChange={(e) => set("kcal", Number(e.target.value))} />
        </Field>
        {kind === "ingredient" && (
          <>
            <Field label="Máximo por hamburguesa" hint="1 = se activa o no; más = contador">
              <input className={inputCls} type="number" min={1} max={5} value={f.maxQty} onChange={(e) => set("maxQty", Number(e.target.value))} />
            </Field>
            <Field label="Color de muestra" hint="Para salsas y miniaturas sin foto">
              <div className="flex items-center gap-2">
                <input type="color" value={f.swatch} onChange={(e) => set("swatch", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-panel p-1" aria-label="Color" />
                <input className={inputCls + " font-mono uppercase"} value={f.swatch} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set("swatch", e.target.value)} pattern="#[0-9a-fA-F]{6}" aria-label="Color en hexadecimal" />
              </div>
            </Field>
            <Field label="Capa en la hamburguesa 3D" className="sm:col-span-2" hint="Reutiliza uno de los modelos 3D para que se vea al elegirlo. Sin capa, aparece en la lista y en el pedido pero no en el 3D.">
              <select className={inputCls} value={f.model} onChange={(e) => set("model", e.target.value)} disabled={p?.id === "patty_x"}>
                <option value="">Sin capa 3D</option>
                {LAYER_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABEL[m] ?? m}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-ink/80">Alérgenos (14 del Reglamento UE 1169/2011)</legend>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const on = f.allergens.includes(a);
            return (
              <button type="button" key={a} aria-pressed={on} onClick={() => set("allergens", on ? f.allergens.filter((x) => x !== a) : [...f.allergens, a])} className={cx("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-gold bg-gold/20 text-gold-ink" : "border-line bg-panel text-muted hover:border-ink/25")}>
                {a}
              </button>
            );
          })}
        </div>
      </fieldset>

      {p?.id !== "burger" && (
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Visible en la carta</p>
            <p className="text-xs text-muted">Oculto: no sale en la web, pero se conserva.</p>
          </div>
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible en la carta" hideLabel />
        </div>
      )}

      <div className="sticky -bottom-5 -mx-5 flex gap-2 border-t border-line bg-panel px-5 py-4">
        {p?.custom && (
          <Btn type="button" onClick={remove} className="text-red-700 hover:border-red/40">
            <Trash2 className="size-4" /> Borrar
          </Btn>
        )}
        <Btn variant="gold" className="flex-1" disabled={busy}>
          {busy ? "Guardando…" : isNew ? "Crear ingrediente" : "Guardar cambios"}
        </Btn>
      </div>
    </form>
  );
}

function confirmDelete(name: string) {
  return window.confirm(`¿Borrar «${name}»? Los pedidos ya hechos no cambian.`);
}
