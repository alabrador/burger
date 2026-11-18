/**
 * Carga el catálogo inicial (desde src/lib/catalog.ts) y crea el usuario dueño.
 * No pisa precios ya editados en el admin salvo con --force.
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
 */
import { hash, verify } from "@node-rs/argon2";
import postgres from "postgres";
import { BASE_PRICE, CATALOG, DRINK_PRICE, DRINKS, PROTEINS } from "../src/lib/catalog";

const e = process.env;
const url = e.DATABASE_URL_DIRECT || e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_URL;
if (!url) {
  // En el build de Vercel (--optional) sin base de datos configurada, no hacemos nada.
  if (process.argv.includes("--optional")) {
    console.log("Sin DATABASE_URL: se omite " + (import.meta.url.includes("seed") ? "la carga de datos" : "la migración"));
    process.exit(0);
  }
  throw new Error("Falta DATABASE_URL");
}
const sql = postgres(url, { max: 1, prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", onnotice: () => {} });
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

type Row = { id: string; kind: string; category: string; name: string; description: string | null; price_cents: number; grams: number; kcal: number; max_qty: number; allergens: string[]; sort: number; model: string | null; swatch: string };
const rows: Row[] = [];
let sort = 0;
rows.push({ id: "burger", kind: "base", category: "base", name: "Hamburguesa (pan brioche + papas)", description: "Pan brioche y papas fritas incluidas", price_cents: c(BASE_PRICE), grams: 85, kcal: 270, max_qty: 1, allergens: ALLERGENS.burger, sort: sort++, model: null, swatch: "#c9792e" });
for (const [id, p] of Object.entries(PROTEINS))
  rows.push({ id, kind: "protein", category: "carne", name: p.label, description: p.note, price_cents: c(p.surcharge), grams: p.g, kcal: p.kcal, max_qty: 1, allergens: ALLERGENS[id] ?? [], sort: sort++, model: id === "angus" ? "patty" : id, swatch: p.swatch });
for (const cat of CATALOG)
  for (const it of cat.items)
    rows.push({ id: it.id, kind: "ingredient", category: cat.id, name: it.name, description: it.note ?? null, price_cents: c(it.price), grams: it.g, kcal: it.kcal, max_qty: it.max, allergens: ALLERGENS[it.id] ?? [], sort: sort++, model: it.id === "patty_x" ? null : it.id, swatch: it.swatch });
for (const [id, d] of Object.entries(DRINKS))
  for (const v of ["normal", "zero"] as const)
    rows.push({ id: v === "zero" ? `${id}_zero` : id, kind: "drink", category: "bebidas", name: v === "zero" ? `${d.name} Zero` : d.name, description: "Lata 355 ml", price_cents: c(DRINK_PRICE), grams: 355, kcal: v === "zero" ? 1 : 140, max_qty: 1, allergens: [], sort: sort++, model: null, swatch: d.color });

// Categorías: se crean una vez; luego se gestionan en el admin.
const CATS: [string, string, boolean][] = [
  ["base", "Base del combo", true],
  ["carne", "Carne", true],
  ["quesos", "Quesos", false],
  ["vegetales", "Vegetales", false],
  ["salsas", "Salsas", false],
  ["extras", "Extras", false],
  ["bebidas", "Bebidas", true],
];
for (const [i, [id, name, locked]] of CATS.entries()) await sql`insert into categories (id, name, sort, locked) values (${id}, ${name}, ${i}, ${locked}) on conflict (id) do nothing`;

// Productos nuevos de la carta base se añaden; los existentes no se tocan (precio, categoría y orden se editan en el admin).
const [done] = await sql`select 1 from settings where key = 'seed:v2'`;
for (const r of rows) {
  await sql`
    insert into products ${sql(r)}
    on conflict (id) do update set kind = excluded.kind
      ${!done ? sql`, model = excluded.model, swatch = excluded.swatch` : sql``}
      ${force ? sql`, name = excluded.name, description = excluded.description, grams = excluded.grams, kcal = excluded.kcal, max_qty = excluded.max_qty, price_cents = excluded.price_cents, allergens = excluded.allergens, category = excluded.category, sort = excluded.sort` : sql``}
  `;
}
if (!done) await sql`insert into settings (key, value) values ('seed:v2', 'true'::jsonb) on conflict do nothing`;
console.log(`Productos: ${rows.length}`);

const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const pass = process.env.ADMIN_PASSWORD;
if (email && pass) {
  if (pass.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres");
  const [u] = await sql<{ id: string; password_hash: string }[]>`select id, password_hash from staff_users where email = ${email}`;
  if (!u) {
    const h = await hash(pass, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
    await sql`
      insert into staff_users (email, name, password_hash, role)
      values (${email}, ${process.env.ADMIN_NAME || "Dueño"}, ${h}, 'owner')
      on conflict (email) do nothing`;
    console.log(`Usuario dueño creado: ${email}`);
  } else if (!(await verify(u.password_hash, pass).catch(() => false))) {
    // La variable manda: si no coincide, se actualiza la contraseña, se desbloquea y se cierran sus sesiones.
    const h = await hash(pass, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
    await sql`update staff_users set password_hash = ${h}, failed_logins = 0, locked_until = null, active = true, password_changed_at = now() where id = ${u.id}`;
    await sql`delete from sessions where user_id = ${u.id}`;
    console.log(`Contraseña de ${email} actualizada desde ADMIN_PASSWORD`);
  } else console.log(`El usuario ${email} ya existe y su contraseña coincide con ADMIN_PASSWORD`);
} else console.log("Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se crea usuario");
await sql.end();
