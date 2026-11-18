import "server-only";
import { kv } from "./redis";

/**
 * Límite de peticiones por ventana fija en Redis.
 * Devuelve ok=false y los segundos que faltan cuando se supera.
 */
export async function rateLimit(bucket: string, id: string, limit: number, windowSec: number) {
  const slot = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${id}:${slot}`;
  try {
    const n = await kv().incr(key, windowSec + 1);
    const retryAfter = windowSec - (Math.floor(Date.now() / 1000) % windowSec);
    return { ok: n <= limit, remaining: Math.max(0, limit - n), retryAfter };
  } catch {
    // Si Redis no responde no bloqueamos el negocio.
    return { ok: true, remaining: limit, retryAfter: 0 };
  }
}
