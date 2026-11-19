import type { Instrumentation } from "next";

export async function register() {}

/**
 * Errores de servidor que no pasan por handle(): páginas, server actions y proxy.
 * Los route handlers ya registran sus errores en handle(), así que aquí se ignoran.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || context.routeType === "route") return;
  try {
    const { reportError } = await import("./server/errors");
    await reportError("render", err, { path: `${request.method} ${request.path}` });
  } catch (e) {
    console.error("[instrumentation]", e);
  }
};
