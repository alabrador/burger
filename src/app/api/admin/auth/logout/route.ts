import { cookieName, destroySession, getStaff } from "@/server/auth";
import { handle, json } from "@/server/http";

export const POST = handle(async (req) => {
  const s = await getStaff(req);
  if (s) await destroySession(s.sid);
  const res = json({ ok: true });
  res.cookies.set(cookieName(), "", { path: "/", maxAge: 0 });
  return res;
});
