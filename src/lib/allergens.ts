/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). */
export const ALLERGEN_LIST = ["gluten", "crustáceos", "huevo", "pescado", "cacahuetes", "soja", "leche", "frutos de cáscara", "apio", "mostaza", "sésamo", "sulfitos", "altramuces", "moluscos"] as const;
export type Allergen = (typeof ALLERGEN_LIST)[number];

/** Alérgenos de la carta base. Desde el admin se editan por producto. */
export const DEFAULT_ALLERGENS: Record<string, Allergen[]> = {
  burger: ["gluten", "huevo", "leche", "sésamo"],
  crispy: ["gluten", "huevo"],
  cheddar: ["leche"],
  swiss: ["leche"],
  house: ["huevo", "mostaza"],
  mustard: ["mostaza"],
  egg: ["huevo"],
};

/** Une los alérgenos de varios productos, sin repetir y en el orden oficial. */
export function allergensOf(ids: string[], map: Record<string, readonly string[]>): string[] {
  const set = new Set(ids.flatMap((id) => map[id] ?? []));
  return ALLERGEN_LIST.filter((a) => set.has(a));
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
