import { z } from "zod";
import { checkOrigin, resendCode } from "@/server/customer-auth";
import { body, handle, json } from "@/server/http";

const schema = z.object({ purpose: z.enum(["register", "login"]), email: z.string().trim().email().max(160) });

export const POST = handle(async (req) => {
  checkOrigin(req);
  const b = await body(req, schema, 1024);
  await resendCode(req, b.purpose, b.email);
  return json({ ok: true });
});
