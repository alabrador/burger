import { z } from "zod";
import { createSession, login } from "@/server/auth";
import { body, handle, json } from "@/server/http";

const schema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/).optional(),
});

export const POST = handle(async (req) => {
  const b = await body(req, schema, 4096);
  const r = await login(req, b.email, b.password, b.code);
  if (r.needTotp) return json({ needTotp: true });
  const res = json({ ok: true });
  await createSession(res, r.user!, req);
  return res;
});
