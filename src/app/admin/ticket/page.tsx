"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api, dt, eur, hm, METHOD } from "../_lib/api";
import type { OrderFull } from "../_lib/order-detail";

/** Ticket de 80 mm para la impresora térmica, con el QR de recogida. */
export default function Ticket() {
  const [d, setD] = useState<OrderFull | null>(null);
  const [qr, setQr] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id") || "";
    api<OrderFull>(`/api/admin/orders/${id}`)
      .then(async (r) => {
        setD(r);
        setQr(await QRCode.toDataURL(r.qr, { margin: 1, width: 240, errorCorrectionLevel: "M" }));
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    if (d && qr) setTimeout(() => print(), 300);
  }, [d, qr]);
  if (err) return <p className="p-4 text-sm">{err}</p>;
  if (!d) return <p className="p-4 text-sm">Cargando…</p>;
  const o = d.order;
  return (
    <main className="ticket mx-auto w-[80mm] bg-white p-3 font-mono text-[12px] leading-snug text-black">
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { background: #fff } .no-print { display: none } }`}</style>
      <div className="text-center">
        <div className="text-base font-bold">CREA TU BURGER</div>
        <div>Ticket de recogida</div>
        <div className="my-2 text-3xl font-bold tracking-[0.2em]">{o.code}</div>
        {qr && <img src={qr} alt={`QR ${o.code}`} className="mx-auto h-40 w-40" />}
        <div className="mt-1">Recogida: {hm(o.pickupAt)} · {dt(o.pickupAt, { day: "2-digit", month: "2-digit" })}</div>
        <div>{o.customerName}</div>
      </div>
      <hr className="my-2 border-dashed border-black" />
      {d.items.map((i) => (
        <div key={i.id} className="mb-1.5">
          <div className="flex justify-between font-bold">
            <span>
              {i.quantity}x {i.title}
            </span>
            <span>{eur(i.totalCents)}</span>
          </div>
          <div>{i.description}</div>
        </div>
      ))}
      {o.notes && <div className="mt-1 border border-black p-1">NOTA: {o.notes}</div>}
      <hr className="my-2 border-dashed border-black" />
      {o.discountCents > 0 && (
        <div className="flex justify-between">
          <span>Descuento</span>
          <span>-{eur(o.discountCents)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{eur(o.totalCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>IVA incl. (10%)</span>
        <span>{eur(o.taxCents)}</span>
      </div>
      <div className="flex justify-between">
        <span>Pago</span>
        <span>
          {METHOD[o.paymentMethod]} {o.paymentStatus === "paid" ? "(PAGADO)" : "(PENDIENTE)"}
        </span>
      </div>
      <div className="mt-2 text-center">{dt(o.createdAt)}</div>
      <button onClick={() => print()} className="no-print mt-3 w-full rounded bg-black py-2 text-white">
        Imprimir
      </button>
    </main>
  );
}
