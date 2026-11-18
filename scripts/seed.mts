/**
 * Carga el catálogo inicial (desde src/lib/catalog.ts) y crea el usuario dueño.
 * No pisa precios ya editados en el admin salvo con --force.
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
 */
import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { BASE_PRICE, CATALOG, DRINK_PRICE, DRINKS, PROTEINS } from "../src/lib/catalog";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
const force = process.argv.includes("--force");
const c = (eur: number) => Math.round(eur * 100);

const ALLERGENS: Record<string, string[]> = {
  burger: ["gluten", "huevo", "leche", "sésamo"],
  crispy: ["gluten", "huevo"],
  cheddar: ["leche"],
  swiss: ["leche"],
  house: ["huevo", "mostaza"],
  mustard: ["mostaza"],
  egg: ["huevo"],
};

type Row = { id: string; kind: string; category: string; name: string; description: string | null; price_cents: number; grams: number; kcal: number; max_qty: number; allergens: string[]; sort: number };
const rows: Row[] = [];
let sort = 0;
rows.push({ id: "burger", kind: "base", category: "base", name: "Hamburguesa (pan brioche + papas)", description: "Pan brioche y papas fritas incluidas", price_cents: c(BASE_PRICE), grams: 85, kcal: 270, max_qty: 1, allergens: ALLERGENS.burger, sort: sort++ });
for (const [id, p] of Object.entries(PROTEINS))
  rows.push({ id, kind: "protein", category: "carne", name: p.label, description: p.note, price_cents: c(p.surcharge), grams: p.g, kcal: p.kcal, max_qty: 1, allergens: ALLERGENS[id] ?? [], sort: sort++ });
for (const cat of CATALOG)
  for (const it of cat.items)
    rows.push({ id: it.id, kind: "ingredient", category: cat.id, name: it.name, description: it.note ?? null, price_cents: c(it.price), grams: it.g, kcal: it.kcal, max_qty: it.max, allergens: ALLERGENS[it.id] ?? [], sort: sort++ });
for (const [id, d] of Object.entries(DRINKS))
  for (const v of ["normal", "zero"] as const)
    rows.push({ id: v === "zero" ? `${id}_zero` : id, kind: "drink", category: "bebidas", name: v === "zero" ? `${d.name} Zero` : d.name, description: "Lata 355 ml", price_cents: c(DRINK_PRICE), grams: 355, kcal: v === "zero" ? 1 : 140, max_qty: 1, allergens: [], sort: sort++ });

for (const r of rows) {
  await sql`
    insert into products ${sql(r)}
    on conflict (id) do update set
      name = excluded.name, kind = excluded.kind, category = excluded.category, sort = excluded.sort,
      description = excluded.description, grams = excluded.grams, kcal = excluded.kcal, max_qty = excluded.max_qty
      ${force ? sql`, price_cents = excluded.price_cents, allergens = excluded.allergens` : sql``}
  `;
}
console.log(`Productos: ${rows.length}`);

const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const pass = process.env.ADMIN_PASSWORD;
if (email && pass) {
  if (pass.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres");
  const h = await hash(pass, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  const r = await sql`
    insert into staff_users (email, name, password_hash, role)
    values (${email}, ${process.env.ADMIN_NAME || "Dueño"}, ${h}, 'owner')
    on conflict (email) do nothing returning id`;
  console.log(r.length ? `Usuario dueño creado: ${email}` : `El usuario ${email} ya existía (sin cambios)`);
} else console.log("Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se crea usuario");
await sql.end();
