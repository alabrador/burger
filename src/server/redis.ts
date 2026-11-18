import "server-only";
import Redis from "ioredis";
import { env } from "./env";

/**
 * Redis para caché, límites de peticiones, idempotencia y sesiones.
 * Funciona con cualquier Redis (Upstash con rediss://, Redis Cloud, propio).
 * Si REDIS_URL no está definida (desarrollo o build) se usa un sustituto en memoria
 * con la misma interfaz mínima, para que la app no se caiga.
 */
export type Kv = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  /** SET NX con TTL; devuelve true si la clave se creó. */
  setNx(key: string, value: string, ttlSec: number): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  /** INCR con TTL en la primera escritura; devuelve el nuevo valor. */
  incr(key: string, ttlSec?: number): Promise<number>;
  ttl(key: string): Promise<number>;
};

const g = globalThis as unknown as { __cbKv?: Kv; __cbRedis?: Redis };

function memoryKv(): Kv {
  const m = new Map<string, { v: string; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp && e.exp < Date.now()) {
      m.delete(k);
      return undefined;
    }
    return e;
  };
  return {
    async get(k) {
      return live(k)?.v ?? null;
    },
    async set(k, v, ttl) {
      m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 });
    },
    async setNx(k, v, ttl) {
      if (live(k)) return false;
      m.set(k, { v, exp: Date.now() + ttl * 1000 });
      return true;
    },
    async del(...ks) {
      ks.forEach((k) => m.delete(k));
    },
    async incr(k, ttl) {
      const e = live(k);
      const n = (e ? Number(e.v) : 0) + 1;
      m.set(k, { v: String(n), exp: e?.exp || (ttl ? Date.now() + ttl * 1000 : 0) });
      return n;
    },
    async ttl(k) {
      const e = live(k);
      return e?.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1;
    },
  };
}

function redisKv(url: string): Kv {
  const r = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
    connectTimeout: 5000,
    lazyConnect: false,
    keyPrefix: "cb:",
  });
  r.on("error", (e) => console.error("[redis]", e.message));
  g.__cbRedis = r;
  return {
    get: (k) => r.get(k),
    async set(k, v, ttl) {
      if (ttl) await r.set(k, v, "EX", ttl);
      else await r.set(k, v);
    },
    async setNx(k, v, ttl) {
      return (await r.set(k, v, "EX", ttl, "NX")) === "OK";
    },
    async del(...ks) {
      if (ks.length) await r.del(...ks);
    },
    async incr(k, ttl) {
      const res = await r.multi().incr(k).expire(k, ttl ?? 0, "NX").exec();
      if (!ttl) await r.persist(k);
      return Number(res?.[0]?.[1] ?? 0);
    },
    ttl: (k) => r.ttl(k),
  };
}

export function kv(): Kv {
  if (!g.__cbKv) {
    const url = env.redisUrl;
    if (!url && env.isProd && process.env.VERCEL) console.warn("[redis] REDIS_URL no definida: usando memoria (no apto para producción)");
    g.__cbKv = url ? redisKv(url) : memoryKv();
  }
  return g.__cbKv;
}

/** Lee de caché o calcula y guarda como JSON. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await kv().get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* si Redis falla seguimos contra la BD */
  }
  const v = await fn();
  kv()
    .set(key, JSON.stringify(v), ttlSec)
    .catch(() => {});
  return v;
}
