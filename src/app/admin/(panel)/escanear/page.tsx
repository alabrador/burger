"use client";

import jsQR from "jsqr";
import { Camera, CameraOff, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../_lib/api";
import { OrderDetail } from "../../_lib/order-detail";
import { Btn, Card, inputCls, PageHead, useToast } from "../../_lib/ui";

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Escáner del mostrador: lee el QR del cliente (o el código a mano) y abre el pedido. */
export default function Escanear() {
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [on, setOn] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ id: string; code: string } | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOn(false);
  }, []);

  const lookup = useCallback(
    async (b: { qr?: string; code?: string }) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await api<{ id: string; code: string }>("/api/admin/orders/scan", { method: "POST", body: b });
        setFound(r);
        stop();
        navigator.vibrate?.(80);
      } catch (e) {
        toast((e as Error).message, "err");
        await new Promise((r) => setTimeout(r, 1500));
      } finally {
        busy.current = false;
      }
    },
    [stop, toast],
  );

  const start = async () => {
    setFound(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setOn(true);
    } catch {
      toast("No se pudo abrir la cámara. Revisa los permisos o escribe el código.", "err");
    }
  };

  useEffect(() => {
    if (!on || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    v.play().catch(() => {});
    const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const det = BD ? new BD({ formats: ["qr_code"] }) : null;
    let raf = 0;
    let last = 0;
    const loop = async (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 200 || busy.current || v.readyState < 2) return;
      last = t;
      let text: string | null = null;
      if (det) {
        const r = await det.detect(v).catch(() => []);
        text = r[0]?.rawValue ?? null;
      } else if (canvas.current) {
        const c = canvas.current;
        const w = (c.width = Math.min(640, v.videoWidth));
        const h = (c.height = Math.round((v.videoHeight / v.videoWidth) * w));
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, w, h);
        text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
      }
      if (text) lookup({ qr: text });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on, lookup]);

  useEffect(() => stop, [stop]);

  return (
    <>
      <PageHead title="Escanear QR" sub="Lee el QR del cliente o escribe el código del pedido" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
            {on ? (
              <>
                <video ref={video} playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-gold/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
              </>
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">La cámara está apagada</div>
            )}
            <canvas ref={canvas} className="hidden" />
          </div>
          <div className="mt-3 flex gap-2">
            {on ? (
              <Btn className="flex-1" onClick={stop}>
                <CameraOff className="size-4" /> Apagar cámara
              </Btn>
            ) : (
              <Btn variant="gold" className="flex-1" onClick={start}>
                <Camera className="size-4" /> Escanear
              </Btn>
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) lookup({ code: code.trim().toUpperCase() });
            }}
          >
            <input className={inputCls + " font-mono uppercase tracking-widest"} placeholder="Código (ej. K7M3QX)" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 12))} aria-label="Código del pedido" />
            <Btn aria-label="Buscar pedido">
              <Search className="size-4" />
            </Btn>
          </form>
        </Card>
        <Card title={found ? `Pedido ${found.code}` : "Pedido"}>{found ? <OrderDetail id={found.id} /> : <p className="py-10 text-center text-sm text-muted">Escanea un QR para ver el pedido y entregarlo.</p>}</Card>
      </div>
    </>
  );
}
