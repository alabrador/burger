import "server-only";
import { sign, verify } from "./crypto";
import { env } from "./env";

/** Token del enlace de seguimiento: solo quien recibió el correo/ticket puede ver el pedido. */
export const trackToken = (code: string) => sign(`trk:${code}`);
export const checkTrackToken = (code: string, t: string) => verify(`trk:${code}`, t);
export const trackUrl = (code: string) => `${env.baseUrl}/pedido?c=${code}&t=${trackToken(code)}`;

/** Contenido del QR de retiro: CB1:<código>:<firma>. Lo valida el escáner del admin. */
export const qrPayload = (code: string) => `CB1:${code}:${sign(`qr:${code}`, 16)}`;
export function parseQr(text: string): string | null {
  const m = /^CB1:([A-Z0-9]{4,12}):([A-Za-z0-9_-]{16})$/.exec(text.trim());
  if (!m) return null;
  return verify(`qr:${m[1]}`, m[2], 16) ? m[1] : null;
}
export const qrImageUrl = (code: string) => `${env.baseUrl}/api/orders/${code}/qr?t=${trackToken(code)}`;
