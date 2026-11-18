import "server-only";
import { kv } from "./redis";

/** Versión del tablero de cocina: cambia con cada pedido nuevo o cambio de estado. */
export const bumpBoard = () => kv().incr("kds:ver").catch(() => 0);
export const boardVersion = async () => Number((await kv().get("kds:ver").catch(() => null)) ?? 0);
