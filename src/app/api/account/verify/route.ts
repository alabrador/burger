import { z } from "zod";
import { checkOrigin, finish } from "@/server/customer-auth";
import { body, handle, json } from "@/server/http";

const schema = z.object({
  purpose: z.enum(["register", "login"]),
  email: z.string().trim().email().max(160),
  code: z.string().regex(/^\d{6}$/, "El código tiene 6 cifras"),
});

/** Paso 2: el código del correo. Si es correcto, abre la sesión. */
export const POST = handle(async (req) => {
  checkOrigin(req);
  const b = await body(req, schema, 1024);
  const res = json({ ok: true });
  await finish(req, res, b.purpose, b.email, b.code);
  return res;
});
