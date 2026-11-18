import "server-only";

/**
 * Variables de entorno del servidor. Se leen de forma perezosa para que el
 * build no falle si aún no están configuradas; cada módulo que las necesita
 * lanza un error claro en el momento de usarlas.
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  /** Acepta los nombres que crean las integraciones de Vercel (Neon, Supabase, Redis). */
  get databaseUrl() {
    const e = process.env;
    const v = e.DATABASE_URL || e.POSTGRES_URL || e.POSTGRES_PRISMA_URL;
    if (!v) throw new Error("Falta la variable de entorno DATABASE_URL (o POSTGRES_URL)");
    return v;
  },
  get redisUrl() {
    return process.env.REDIS_URL || process.env.KV_URL || "";
  },
  /** Clave para firmar QR, enlaces de seguimiento y tokens (mín. 32 caracteres). */
  get appSecret() {
    const v = req("APP_SECRET");
    if (v.length < 32) throw new Error("APP_SECRET debe tener al menos 32 caracteres");
    return v;
  },
  /** Clave AES-256 en base64 (32 bytes) para cifrar secretos guardados en la BD. */
  get encryptionKey() {
    const b = Buffer.from(req("APP_ENCRYPTION_KEY"), "base64");
    if (b.length !== 32) throw new Error("APP_ENCRYPTION_KEY debe ser 32 bytes en base64");
    return b;
  },
  get baseUrl() {
    return (process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
