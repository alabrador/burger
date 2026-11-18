import { NextResponse, type NextRequest } from "next/server";

/**
 * Primera barrera del panel: sin cookie de sesión no se sirve /admin (salvo el login).
 * La validación real de la sesión, el rol y el CSRF se hace en cada API (/api/admin/*).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const has = req.cookies.has("__Host-cb_admin") || req.cookies.has("cb_admin");
  if (!has && pathname !== "/admin/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
