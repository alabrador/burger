import { z } from "zod";
import { admin } from "@/server/admin";
import { ApiError, body, json, limit } from "@/server/http";
import { sendTest } from "@/server/mail/outbox";

export const POST = admin("settings.edit", async (req, me, log) => {
  await limit(req, "smtp-test", 5, 300, me.id);
  const { to } = await body(req, z.object({ to: z.string().trim().email() }), 512);
  try {
    await sendTest(to);
  } catch (e) {
    throw new ApiError(502, `No se pudo enviar: ${(e as Error).message}`.slice(0, 300), "smtp");
  }
  await log("settings.smtp_test", "settings", "smtp", { to });
  return json({ ok: true });
});
