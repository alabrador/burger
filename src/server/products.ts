import "server-only";
import { z } from "zod";
import { MODELS } from "@/lib/models";

import { ALLERGEN_LIST as ALLERGENS } from "@/lib/allergens";

export { ALLERGENS };
/** Capas 3D que se pueden reutilizar para un ingrediente (el pan no). */
export const LAYER_MODELS = Object.keys(MODELS).filter((k) => !k.startsWith("bun_"));

const slugRe = /^[a-z0-9_]{1,32}$/;
export const productId = z.string().regex(slugRe);

export const productFields = {
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(160).nullable(),
  category: z.string().regex(slugRe),
  priceCents: z.number().int().min(0).max(100_000),
  grams: z.number().int().min(0).max(5000),
  kcal: z.number().int().min(0).max(5000),
  maxQty: z.number().int().min(1).max(5),
  allergens: z.array(z.enum(ALLERGENS)).max(14),
  active: z.boolean(),
  soldOut: z.boolean(),
  sort: z.number().int().min(0).max(100_000),
  model: z.enum(LAYER_MODELS as [string, ...string[]]).nullable(),
  swatch: z.string().regex(/^#[0-9a-f]{6}$/i),
};

/** Convierte un nombre en un id corto: "Queso de cabra" → "queso_de_cabra". */
export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || "item"
  );
}

/** Valida una imagen en data URL (webp/png/jpeg) por cabecera real, no por lo que diga el cliente. */
export function decodeImage(dataUrl: string): { type: string; data: Buffer } | null {
  const m = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isWebp = data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  const type = isPng ? "image/png" : isJpg ? "image/jpeg" : isWebp ? "image/webp" : null;
  return type ? { type, data } : null;
}
