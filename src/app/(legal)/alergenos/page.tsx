import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ALLERGEN_LIST, capitalize, DEFAULT_ALLERGENS } from "@/lib/allergens";
import { CATALOG, PROTEINS } from "@/lib/catalog";
import { loadCatalog, loadCategories } from "@/server/catalog";
import { contact, legalInfo } from "../legal";

export const metadata: Metadata = {
  title: "Alérgenos",
  description: "Tabla con los 14 alérgenos de cada ingrediente de Crea tu Burger: pan, carnes, quesos, vegetales, salsas y extras.",
  alternates: { canonical: "/alergenos" },
};

type Row = { id: string; name: string; group: string; allergens: string[] };
const GROUP: Record<string, string> = { base: "Base", protein: "Carne", drink: "Bebidas" };

/** Carta base, por si la base de datos no responde. */
function fallback(): Row[] {
  return [
    { id: "burger", name: "Pan brioche y papas fritas", group: "Base", allergens: DEFAULT_ALLERGENS.burger },
    ...Object.entries(PROTEINS).map(([id, p]) => ({ id, name: p.label, group: "Carne", allergens: DEFAULT_ALLERGENS[id] ?? [] })),
    ...CATALOG.flatMap((c) => c.items.filter((it) => it.id !== "patty_x").map((it) => ({ id: it.id, name: it.name, group: c.name, allergens: DEFAULT_ALLERGENS[it.id] ?? [] }))),
  ];
}

async function rows(): Promise<Row[]> {
  await connection();
  try {
    const [cat, cats] = await Promise.all([loadCatalog(), loadCategories()]);
    const names = new Map(cats.filter((c) => c.active).map((c) => [c.id, c.name]));
    return cat
      .filter((p) => p.active && p.id !== "patty_x" && (p.kind !== "ingredient" || names.has(p.category)))
      .map((p) => ({
        id: p.id,
        name: p.kind === "base" ? "Pan brioche y papas fritas" : p.name,
        group: GROUP[p.kind] ?? names.get(p.category) ?? capitalize(p.category),
        allergens: p.allergens,
      }));
  } catch {
    return fallback();
  }
}

async function Table() {
  const [list, info] = await Promise.all([rows(), legalInfo()]);
  const groups = [...new Set(list.map((r) => r.group))];
  return (
    <>
      {/* Móvil: una ficha por producto con sus alérgenos */}
      <div className="mt-6 space-y-5 sm:hidden">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="!mt-0">{g}</h2>
            <ul className="!mt-2 !list-none !pl-0 divide-y divide-line rounded-xl border border-line bg-panel">
              {list
                .filter((r) => r.group === g)
                .map((r) => (
                  <li key={r.id} className="!mt-0 px-3 py-2.5">
                    <p className="!mt-0 font-semibold text-ink">{r.name}</p>
                    {r.allergens.length ? (
                      <p className="!mt-1 flex flex-wrap gap-1.5">
                        {ALLERGEN_LIST.filter((a) => r.allergens.includes(a)).map((a) => (
                          <span key={a} className="rounded-full bg-red/15 px-2 py-0.5 text-xs font-semibold text-red-200 ring-1 ring-red/40">
                            {capitalize(a)}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="!mt-0.5 text-xs text-muted">Sin alérgenos declarados</p>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line max-sm:hidden">
        <table className="legal-table min-w-[44rem]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-bg">Producto</th>
              {ALLERGEN_LIST.map((a) => (
                <th key={a} className="whitespace-nowrap text-center text-[0.6875rem] [writing-mode:vertical-rl] rotate-180">
                  {capitalize(a)}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr>
                <th colSpan={ALLERGEN_LIST.length + 1} className="bg-panel text-gold">
                  {g}
                </th>
              </tr>
              {list
                .filter((r) => r.group === g)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="sticky left-0 bg-bg font-semibold text-ink">{r.name}</td>
                    {ALLERGEN_LIST.map((a) => (
                      <td key={a} className="text-center">
                        {r.allergens.includes(a) ? (
                          <span className="inline-block size-3 rounded-full bg-red" role="img" aria-label={`Contiene ${a}`} title={`Contiene ${a}`} />
                        ) : (
                          <span className="sr-only">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="max-sm:hidden">
        <span className="mr-1.5 inline-block size-3 rounded-full bg-red align-middle" aria-hidden /> = contiene el alérgeno.
      </p>
      <h2>Trazas</h2>
      <p>
        Todo se prepara en la misma cocina, en la misma plancha y con la misma freidora, así que no podemos garantizar la ausencia de trazas de ningún
        alérgeno. Si tienes una alergia grave, avísanos en la nota para cocina o escríbenos a {contact(info)} antes de pedir.
      </p>
    </>
  );
}

export default function Alergenos() {
  return (
    <article className="legal">
      <h1>Alérgenos</h1>
      <p className="legal-date">Información según el Reglamento (UE) 1169/2011</p>
      <p>
        Esta tabla muestra cuáles de los 14 alérgenos de declaración obligatoria contiene cada ingrediente. Al crear tu hamburguesa, el carrito te muestra
        también los alérgenos de la combinación que has elegido.
      </p>
      <Suspense fallback={<p className="text-muted">Cargando la tabla…</p>}>
        <Table />
      </Suspense>
    </article>
  );
}
