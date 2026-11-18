// Catálogo del configurador: precios, pesos, calorías y combos.
// Los ids de ingrediente coinciden con las claves de MODELS en lib/models.ts.

export type ProteinId = "angus" | "grilled" | "crispy";
export type Doneness = "Medio" | "Tres cuartos" | "Bien cocido";

export type Item = {
  id: string;
  name: string;
  note?: string;
  price: number;
  g: number;
  kcal: number;
  /** cantidad máxima; 1 = interruptor, >1 = contador */
  max: number;
  swatch: string;
};

export type CategoryId = "carne" | "quesos" | "vegetales" | "salsas" | "extras";
export type Category = { id: CategoryId; name: string; items: Item[] };

export const BASE_PRICE = 12.9;

export const BUN = {
  name: "Pan brioche",
  note: "Glaseado con mantequilla y ajonjolí",
  g: 85,
  kcal: 270,
  swatch: "#c9792e",
};

export const PROTEINS: Record<
  ProteinId,
  { label: string; name: string; note: string; promo: string; g: number; kcal: number; swatch: string; surcharge: number }
> = {
  angus: { label: "Angus", name: "Carne Angus 250 g", note: "Sellada a la plancha", promo: "100% Angus · Sabor premium", g: 250, kcal: 620, swatch: "#5a2f1b", surcharge: 0 },
  grilled: { label: "Pollo plancha", name: "Pechuga de pollo 250 g", note: "A la parrilla con marcas de grill", promo: "Pechuga entera · A la parrilla", g: 250, kcal: 410, swatch: "#d8a35c", surcharge: 0 },
  crispy: { label: "Pollo crispy", name: "Pollo crispy 250 g", note: "Empanizado y frito, extra crujiente", promo: "Empanizado casero · Extra crujiente", g: 280, kcal: 590, swatch: "#c27a26", surcharge: 1 },
};

export type DrinkId = "coca" | "sprite";
export type DrinkVariant = "normal" | "zero";
/** Bebidas del combo (lata 355 ml). Se pintan con una lata genérica, sin logos. */
export const DRINKS: Record<DrinkId, { name: string; color: string }> = {
  coca: { name: "Coca-Cola", color: "#d0161f" },
  sprite: { name: "Sprite", color: "#1f9a4a" },
};
export const DRINK_PRICE = 2.5;
export const FRIES = { name: "Papas fritas", note: "Porción mediana incluida" };

export const DONENESS: Doneness[] = ["Medio", "Tres cuartos", "Bien cocido"];

export const CATALOG: Category[] = [
  {
    id: "carne",
    name: "Carne",
    items: [
      { id: "patty_x", name: "Porción extra", note: "Otros 250 g de la proteína elegida", price: 5.5, g: 250, kcal: 620, max: 2, swatch: "#5a2f1b" },
    ],
  },
  {
    id: "quesos",
    name: "Quesos",
    items: [
      { id: "cheddar", name: "Cheddar añejo", note: "Se funde sobre la carne", price: 1.5, g: 20, kcal: 80, max: 2, swatch: "#ef9a1e" },
      { id: "swiss", name: "Queso suizo", note: "Suave y cremoso", price: 1.5, g: 20, kcal: 75, max: 2, swatch: "#f1dc9a" },
    ],
  },
  {
    id: "vegetales",
    name: "Vegetales",
    items: [
      { id: "lettuce", name: "Lechuga", note: "Hoja crespa", price: 0.5, g: 15, kcal: 3, max: 1, swatch: "#79bd42" },
      { id: "tomato", name: "Tomate", note: "Tres rodajas", price: 0.8, g: 40, kcal: 8, max: 1, swatch: "#d53a2a" },
      { id: "onion", name: "Cebolla morada", note: "Aros crudos", price: 0.5, g: 15, kcal: 6, max: 1, swatch: "#b77aa6" },
      { id: "caramel", name: "Cebolla caramelizada", note: "Cocción lenta", price: 1, g: 30, kcal: 60, max: 1, swatch: "#8a4a18" },
      { id: "pickles", name: "Pepinillos", note: "Rodajas encurtidas", price: 0.5, g: 15, kcal: 3, max: 1, swatch: "#6f8f2c" },
      { id: "jalapeno", name: "Jalapeños", note: "Picante medio", price: 0.7, g: 10, kcal: 3, max: 1, swatch: "#3f8a2a" },
    ],
  },
  {
    id: "salsas",
    name: "Salsas",
    items: [
      { id: "house", name: "Salsa de la casa", note: "Mayo ahumada", price: 0, g: 15, kcal: 90, max: 1, swatch: "#e9a46a" },
      { id: "ketchup", name: "Kétchup", price: 0, g: 15, kcal: 20, max: 1, swatch: "#b3200f" },
      { id: "mustard", name: "Mostaza", price: 0, g: 10, kcal: 10, max: 1, swatch: "#d9a514" },
      { id: "bbq", name: "BBQ ahumada", price: 0.5, g: 15, kcal: 40, max: 1, swatch: "#5a1c0c" },
    ],
  },
  {
    id: "extras",
    name: "Extras",
    items: [
      { id: "bacon", name: "Tocino ahumado", note: "Dos tiras por porción", price: 2, g: 30, kcal: 160, max: 2, swatch: "#9c3a22" },
      { id: "egg", name: "Huevo frito", note: "Yema suave", price: 1.5, g: 50, kcal: 90, max: 1, swatch: "#f4b21b" },
    ],
  },
];

/** Miniatura renderizada desde el modelo 3D de cada ingrediente. */
export function thumb(id: string, protein: ProteinId): string {
  if (id === "patty_x" || id === "protein") return `/thumbs/${protein === "angus" ? "patty" : protein}.webp`;
  return `/thumbs/${id}.webp`;
}

export const ITEMS: Record<string, Item> = Object.fromEntries(
  CATALOG.flatMap((c) => c.items.map((i) => [i.id, i])),
);

export type Qty = Record<string, number>;

export type Preset = { name: string; protein?: ProteinId; qty: Qty };

export const PRESETS: Preset[] = [
  { name: "Clásica", qty: { cheddar: 1, lettuce: 1, tomato: 1, onion: 1, pickles: 1, house: 1 } },
  { name: "Bacon BBQ", qty: { cheddar: 2, bacon: 2, caramel: 1, bbq: 1 } },
  { name: "Doble Angus", protein: "angus", qty: { patty_x: 1, cheddar: 2, bacon: 1, lettuce: 1, tomato: 1, house: 1 } },
  { name: "La completa", qty: { patty_x: 1, cheddar: 1, swiss: 1, bacon: 1, egg: 1, lettuce: 1, tomato: 1, onion: 1, pickles: 1, jalapeno: 1, house: 1, ketchup: 1 } },
  { name: "Pollo crispy", protein: "crispy", qty: { cheddar: 1, lettuce: 1, tomato: 1, pickles: 1, house: 1 } },
  { name: "Pollo a la plancha", protein: "grilled", qty: { lettuce: 1, tomato: 1, onion: 1, mustard: 1 } },
  { name: "Solo base", qty: {} },
];

/** Modelo 3D de cada ingrediente de la carta base (la clave de MODELS coincide con el id). */
export type ModelMap = Record<string, { model: string | null }>;
const STATIC_MODELS: ModelMap = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, { model: id === "patty_x" ? null : id }]));

const VEG = ["lettuce", "tomato", "onion", "pickles"];
const CHEESE = ["cheddar", "swiss"];
const TOP = ["caramel", "egg", "jalapeno", "house", "ketchup", "mustard", "bbq"];

/**
 * Orden de abajo hacia arriba. Devuelve claves únicas por capa (p. ej. "cheddar#1");
 * lo que va antes de "#" es el modelo 3D. Un ingrediente creado en el admin se
 * apila donde iría el modelo que reutiliza; si no tiene modelo, no sale en 3D.
 */
export function stackOrder(qty: Qty, protein: ProteinId, items: ModelMap = STATIC_MODELS): string[] {
  const picked = Object.entries(qty)
    .filter(([id, n]) => n > 0 && id !== "patty_x" && items[id]?.model)
    .map(([id, n]) => ({ id, n, m: items[id].model! }));
  const group = (models: string[]) =>
    picked
      .filter((p) => models.includes(p.m))
      .sort((x, y) => models.indexOf(x.m) - models.indexOf(y.m) || (x.id === x.m ? -1 : y.id === y.m ? 1 : x.id.localeCompare(y.id)));
  const known = new Set([...VEG, ...CHEESE, "bacon", ...TOP]);
  const single = (p: { id: string; n: number; m: string }) =>
    Array.from({ length: p.n }, (_, i) => (p.id === p.m && i === 0 ? p.m : `${p.m}#${p.id}-${i}`));

  const out = ["bun_bottom"];
  for (const p of group(VEG)) out.push(...single(p));
  const portions = 1 + (qty.patty_x ?? 0);
  const slices: string[] = [];
  for (const p of group(CHEESE)) for (let i = 0; i < p.n; i++) slices.push(p.m);
  let s = 0;
  for (let p = 0; p < portions; p++) {
    out.push(`${protein === "angus" ? "patty" : protein}#${p}`);
    const take = p < portions - 1 ? Math.min(1, slices.length - s) : slices.length - s;
    for (let t = 0; t < take; t++, s++) out.push(`${slices[s]}#${s}`);
  }
  for (const p of group(["bacon"])) for (let i = 0; i < p.n; i++) out.push(p.id === "bacon" ? `bacon#${i}` : `bacon#${p.id}-${i}`);
  // capas de proteína reutilizadas como extra (p. ej. otra carne) van sobre el tocino
  for (const p of picked.filter((p) => !known.has(p.m))) out.push(...Array.from({ length: p.n }, (_, i) => `${p.m}#${p.id}-${i}`));
  for (const p of group(TOP)) out.push(...single(p));
  out.push("bun_top");
  return out;
}

/** Precios vigentes (los del admin cuando ya se han cargado). */
export type Prices = {
  base: number;
  surcharge: Record<ProteinId, number>;
  items: Record<string, Pick<Item, "price" | "g" | "kcal">>;
};
export const STATIC_PRICES: Prices = {
  base: BASE_PRICE,
  surcharge: Object.fromEntries(Object.entries(PROTEINS).map(([k, p]) => [k, p.surcharge])) as Record<ProteinId, number>,
  items: ITEMS,
};

export function totals(qty: Qty, protein: ProteinId, pr: Prices = STATIC_PRICES) {
  const P = PROTEINS[protein];
  const sur = pr.surcharge[protein] ?? P.surcharge;
  let price = pr.base + sur;
  let g = BUN.g + P.g;
  let kcal = BUN.kcal + P.kcal;
  for (const [id, n] of Object.entries(qty)) {
    const it = pr.items[id];
    if (!it || !n) continue;
    if (id === "patty_x") {
      price += (it.price + sur) * n;
      g += P.g * n;
      kcal += P.kcal * n;
    } else {
      price += it.price * n;
      g += it.g * n;
      kcal += it.kcal * n;
    }
  }
  return { price, g, kcal };
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** Precio en euros con formato español: 12,90 € */
export const money = (n: number) => EUR.format(n);
