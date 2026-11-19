import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { rateLimit } from "./ratelimit";
import { reportError } from "./errors";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, {
    ...(typeof init === "number" ? { status: init } : init),
    headers: { "Cache-Control": "no-store", ...(typeof init === "object" ? (init.headers as Record<string, string>) : {}) },
  });

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  return (
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("cf-connecting-ip") ||
    "0.0.0.0"
  ).slice(0, 64);
}

/** Lee y valida el cuerpo JSON (máx. 64 KB por defecto). */
export async function body<T extends z.ZodType>(req: Request, schema: T, maxBytes = 64 * 1024): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new ApiError(413, "Petición demasiado grande", "too_large");
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new ApiError(415, "Se esperaba JSON", "bad_content_type");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Petición demasiado grande", "too_large");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, "JSON no válido", "bad_json");
  }
  return schema.parse(raw);
}

export function query<T extends z.ZodType>(req: NextRequest, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export async function limit(req: Request, bucket: string, max: number, windowSec: number, id = clientIp(req)) {
  const r = await rateLimit(bucket, id, max, windowSec);
  if (!r.ok)
    throw new ApiError(429, "Demasiadas peticiones. Inténtalo en unos segundos.", "rate_limited", undefined, {
      "Retry-After": String(r.retryAfter),
    });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Envuelve un route handler: errores de validación → 422, ApiError → su código, resto → 500 sin filtrar detalles. */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError)
        return json({ error: e.message, code: e.code, details: e.details }, { status: e.status, headers: e.headers });
      if (e instanceof ZodError)
        return json(
          {
            error: "Datos no válidos",
            code: "validation",
            details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          422,
        );
      // redirect()/notFound() de Next se relanzan
      if (e && typeof e === "object" && "digest" in e) throw e;
      await reportError("api", e, { path: `${req.method} ${req.nextUrl.pathname}` });
      return json({ error: "Error interno", code: "internal" }, 500);
    }
  };
}
