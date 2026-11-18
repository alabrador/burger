import "server-only";
import { asc } from "drizzle-orm";
import { db, schema } from "./db";
import { cached, kv } from "./redis";
import { ApiError } from "./http";
import type { BurgerConfig } from "./db/schema";

export type Product = typeof schema.products.$inferSelect;
const KEY = "catalog:v1";

export async function loadCatalog(): Promise<Product[]> {
  return cached(KEY, 300, () => db().select().from(schema.products).orderBy(asc(schema.products.sort)));
}
export const invalidateCatalog = () => kv().del(KEY);

export type PricedLine = {
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  title: string;
  description: string;
  config: BurgerConfig;
};

/**
 * Calcula el precio de una hamburguesa con los precios de la BD. El navegador
 * nunca envía precios: solo ids y cantidades, que se validan aquí.
 */
export function priceLine(cat: Product[], cfg: BurgerConfig, quantity: number): PricedLine {
  const byId = new Map(cat.map((p) => [p.id, p]));
  const avail = (p: Product | undefined, kind: Product["kind"]) => {
    if (!p || p.kind !== kind || !p.active) throw new ApiError(422, "Producto no disponible", "unavailable", { id: p?.id });
    if (p.soldOut) throw new ApiError(409, `${p.name} está agotado ahora mismo`, "sold_out", { id: p.id });
    return p;
  };
  const base = avail(byId.get("burger"), "base");
  const protein = avail(byId.get(cfg.protein), "protein");
  let unit = base.priceCents + protein.priceCents;
  const parts: string[] = [];
  const entries = Object.entries(cfg.items).sort(
    (a, b) => (byId.get(a[0])?.sort ?? 0) - (byId.get(b[0])?.sort ?? 0),
  );
  for (const [id, n] of entries) {
    const p = avail(byId.get(id), "ingredient");
    if (!Number.isInteger(n) || n < 1 || n > p.maxQty)
      throw new ApiError(422, `Cantidad no válida para ${p.name}`, "bad_qty", { id });
    unit += (id === "patty_x" ? p.priceCents + protein.priceCents : p.priceCents) * n;
    parts.push(id === "patty_x" ? (n === 1 ? "Doble carne" : "Triple carne") : n > 1 ? `${n}× ${p.name}` : p.name);
  }
  let drinkName = "";
  if (cfg.drink) {
    const d = avail(byId.get(cfg.drink), "drink");
    unit += d.priceCents;
    drinkName = d.name;
  }
  const extras = ["Papas fritas", drinkName].filter(Boolean).join(" · ");
  return {
    quantity,
    unitPriceCents: unit,
    totalCents: unit * quantity,
    title: `Burger ${protein.name}`,
    description: [parts.join(", ") || "Sin ingredientes extra", extras].join(" · "),
    config: { protein: protein.id, items: Object.fromEntries(entries), drink: cfg.drink ?? null },
  };
}
