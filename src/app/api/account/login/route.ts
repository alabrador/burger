import { z } from "zod";
import { checkOrigin, startLogin } from "@/server/customer-auth";
import { body, handle, json } from "@/server/http";

const schema = z.object({ email: z.string().trim().email("Correo no válido").max(160), password: z.string().min(1).max(128) });

/** Inicio de sesión, paso 1: contraseña. Si es correcta, se envía el código al correo. */
export const POST = handle(async (req) => {
  checkOrigin(req);
  const b = await body(req, schema, 2048);
  await startLogin(req, b.email, b.password);
  return json({ ok: true, next: "code" });
});
