import { z } from "zod";
import { reportError } from "@/server/errors";
import { body, handle, limit } from "@/server/http";

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(3000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(200).optional(),
});

/** Errores del navegador (pantallas de error de la web). Se guardan sin aviso por correo. */
export const POST = handle(async (req) => {
  await limit(req, "client-error", 10, 300);
  const b = await body(req, schema, 8 * 1024);
  const err = Object.assign(new Error(b.message), { stack: b.stack, digest: b.digest });
  await reportError("client", err, { path: b.path, level: "warn", detail: b.stack });
  return new Response(null, { status: 204 });
});
