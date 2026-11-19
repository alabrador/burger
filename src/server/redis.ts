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

const g = globalThis as unknown as { __cbKv?: Kv; __cbRedis?: Redis; __cbKvDegradedAt?: number };

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
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    connectTimeout: 5000,
    // Si Redis no está conectado, las órdenes fallan al momento (y usamos la memoria) en vez de esperar en cola.
    enableOfflineQueue: false,
    commandTimeout: 1500,
    lazyConnect: false,
    keyPrefix: "cb:",
  });
  let lastLog = 0;
  r.on("error", (e) => {
    if (Date.now() - lastLog > 60_000) {
      lastLog = Date.now();
      console.error("[redis]", e.message);
    }
  });
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

/**
 * Redis con respaldo en memoria: si Redis falla o tarda, cada operación se hace en la memoria
 * de esta instancia. Así los límites de intentos siguen aplicándose (por instancia, no abiertos),
 * los inicios de sesión y los pedidos siguen funcionando, y al volver Redis todo sigue igual.
 */
function resilientKv(primary: Kv, backup: Kv): Kv {
  let lastWarn = 0;
  const run =
    <A extends unknown[], R>(op: (k: Kv, ...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      try {
        return await op(primary, ...a);
      } catch (e) {
        g.__cbKvDegradedAt = Date.now();
        if (Date.now() - lastWarn > 60_000) {
          lastWarn = Date.now();
          console.warn("[redis] sin respuesta, usando memoria:", (e as Error).message);
        }
        return op(backup, ...a);
      }
    };
  return {
    get: run((k, key: string) => k.get(key)),
    set: run((k, key: string, v: string, ttl?: number) => k.set(key, v, ttl)),
    setNx: run((k, key: string, v: string, ttl: number) => k.setNx(key, v, ttl)),
    del: run((k, ...keys: string[]) => k.del(...keys)),
    incr: run((k, key: string, ttl?: number) => k.incr(key, ttl)),
    ttl: run((k, key: string) => k.ttl(key)),
  };
}

export function kv(): Kv {
  if (!g.__cbKv) {
    const url = env.redisUrl;
    if (!url && env.isProd && process.env.VERCEL) console.warn("[redis] REDIS_URL no definida: usando memoria (no apto para producción)");
    g.__cbKv = url ? resilientKv(redisKv(url), memoryKv()) : memoryKv();
  }
  return g.__cbKv;
}

/** Comprueba Redis de verdad (sin el respaldo en memoria). null = no hay Redis configurado. */
export async function redisPing(): Promise<boolean | null> {
  kv();
  const r = g.__cbRedis;
  if (!r) return null;
  try {
    // Recién creada la conexión aún no está lista: esperamos un momento antes de dar Redis por caído.
    if (r.status !== "ready")
      await new Promise<void>((ok) => {
        const t = setTimeout(ok, 2000);
        r.once("ready", () => (clearTimeout(t), ok()));
      });
    return (await r.ping()) === "PONG";
  } catch {
    return false;
  }
}

/** Últimos valores buenos por clave: si la base de datos cae, se sirven aunque estén caducados. */
const lastGood = new Map<string, unknown>();

/** Lee de caché o calcula y guarda como JSON. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await kv().get(key);
    if (hit) {
      const v = JSON.parse(hit) as T;
      lastGood.set(key, v);
      return v;
    }
  } catch {
    /* si Redis falla seguimos contra la BD */
  }
  let v: T;
  try {
    v = await fn();
  } catch (e) {
    // La base de datos no responde: mejor la última versión conocida que un error.
    if (lastGood.has(key)) {
      console.warn("[cache] usando copia anterior de", key, (e as Error).message);
      return lastGood.get(key) as T;
    }
    throw e;
  }
  lastGood.set(key, v);
  kv()
    .set(key, JSON.stringify(v), ttlSec)
    .catch(() => {});
  return v;
}
