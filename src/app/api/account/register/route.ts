import { z } from "zod";
import { passwordProblem } from "@/server/auth";
import { checkOrigin, startRegister } from "@/server/customer-auth";
import { body, handle, json } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().email("Correo no válido").max(160),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, "Teléfono no válido").optional(),
  password: z.string().superRefine((p, ctx) => {
    const e = passwordProblem(p);
    if (e) ctx.addIssue({ code: "custom", message: e });
  }),
  marketing: z.boolean().optional(),
  acceptTerms: z.literal(true, { error: "Acepta las condiciones y la privacidad" }),
});

/** Registro, paso 1: valida los datos y envía el código al correo. La cuenta se crea al verificarlo. */
export const POST = handle(async (req) => {
  checkOrigin(req);
  const b = await body(req, schema, 4096);
  await startRegister(req, b);
  return json({ ok: true, next: "code" });
});
