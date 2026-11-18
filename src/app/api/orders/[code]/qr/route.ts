import QRCode from "qrcode";
import { ApiError, handle, limit } from "@/server/http";
import { checkTrackToken, qrPayload } from "@/server/tokens";

/** QR de recogida en PNG (para el correo y el ticket). */
export const GET = handle<RouteContext<"/api/orders/[code]/qr">>(async (req, ctx) => {
  await limit(req, "qr", 120, 60);
  const { code } = await ctx.params;
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!/^[A-Z0-9]{4,12}$/.test(code) || !checkTrackToken(code, t)) throw new ApiError(404, "No encontrado", "not_found");
  const png = await QRCode.toBuffer(qrPayload(code), { type: "png", width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#120d0b", light: "#ffffff" } });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400, immutable" } });
});
