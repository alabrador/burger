const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** 1290 → "12,90 €" */
export const eur = (cents: number) => fmt.format(cents / 100);
/** Parte de IVA incluida en un total (tipo en puntos básicos, 1000 = 10 %). */
export const taxIncluded = (totalCents: number, rateBp: number) => Math.round(totalCents - totalCents / (1 + rateBp / 10000));
