import { checkOrigin, customerCookie, endSession, getCustomer } from "@/server/customer-auth";
import { handle, json } from "@/server/http";

export const POST = handle(async (req) => {
  checkOrigin(req);
  const c = await getCustomer(req);
  if (c) await endSession(c.sid);
  const res = json({ ok: true });
  res.cookies.set(customerCookie(), "", { path: "/", maxAge: 0 });
  return res;
});
