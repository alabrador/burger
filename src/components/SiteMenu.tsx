"use client";

import { ChevronRight, FileText, Info, ShieldCheck, Cookie, WheatOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "./Brand";

const LINKS = [
  { href: "/alergenos", label: "Alérgenos", sub: "Los 14 alérgenos de cada ingrediente", icon: WheatOff },
  { href: "/condiciones", label: "Condiciones de venta", sub: "Pedidos, pagos, recogida y cancelaciones", icon: FileText },
  { href: "/privacidad", label: "Privacidad", sub: "Qué datos usamos y tus derechos", icon: ShieldCheck },
  { href: "/cookies", label: "Cookies", sub: "Solo cookies técnicas", icon: Cookie },
  { href: "/aviso-legal", label: "Aviso legal", sub: "Datos del titular de la web", icon: Info },
];

/** Menú lateral con la información para el cliente: alérgenos y páginas legales. */
export default function SiteMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menú">
      <button aria-label="Cerrar menú" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xs flex-col border-r border-line bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <Logo compact />
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </header>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Información">
          <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">Información</p>
          {LINKS.map(({ href, label, sub, icon: Icon }) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-gold ring-1 ring-line">
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{label}</span>
                <span className="block text-xs leading-snug text-muted">{sub}</span>
              </span>
              <ChevronRight className="size-4 text-muted group-hover:text-gold" />
            </Link>
          ))}
        </nav>
        <p className="border-t border-line px-4 py-3 text-[0.6875rem] text-muted">Precios en euros con IVA incluido.</p>
      </aside>
    </div>
  );
}
