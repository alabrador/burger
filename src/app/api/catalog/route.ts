import { loadCatalog, loadCategories } from "@/server/catalog";
import { handle, json } from "@/server/http";

/** Carta pública para el configurador: categorías y productos visibles con sus precios actuales. */
export const GET = handle(async () => {
  const [cats, products] = await Promise.all([loadCategories(), loadCatalog()]);
  const visible = new Set(cats.filter((c) => c.active).map((c) => c.id));
  return json(
    {
      categories: cats.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })),
      products: products
        .filter((p) => p.active && (visible.has(p.category) || p.kind !== "ingredient"))
        .map((p) => ({
          id: p.id,
          kind: p.kind,
          category: p.category,
          name: p.name,
          note: p.description,
          priceCents: p.priceCents,
          grams: p.grams,
          kcal: p.kcal,
          max: p.maxQty,
          soldOut: p.soldOut,
          model: p.model,
          swatch: p.swatch,
          allergens: p.allergens,
          img: p.imageV ? `/api/catalog/img/${p.id}?v=${p.imageV}` : null,
        })),
    },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=60" } },
  );
});
