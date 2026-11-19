import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSettings } from "@/server/settings";

export type LegalInfo = {
  name: string;
  legalName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
};

/** Datos del titular que se rellenan en Admin → Configuración → Datos del local. */
export async function legalInfo(): Promise<LegalInfo> {
  await connection();
  try {
    const { store: s } = await getSettings();
    const address = [s.address, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return { name: s.name, legalName: s.legalName || s.name, taxId: s.taxId, address, phone: s.phone, email: s.email };
  } catch {
    return { name: "Crea tu Burger", legalName: "Crea tu Burger", taxId: "", address: "", phone: "", email: "" };
  }
}

/** Página legal: título fijo y cuerpo que lee los datos del local al pedirla. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: (i: LegalInfo) => React.ReactNode }) {
  return (
    <article className="legal">
      <h1>{title}</h1>
      <p className="legal-date">Última actualización: {updated}</p>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Body>{children}</Body>
      </Suspense>
    </article>
  );
}

async function Body({ children }: { children: (i: LegalInfo) => React.ReactNode }) {
  return <>{children(await legalInfo())}</>;
}

/** Bloque con los datos del titular, sin líneas vacías. */
export function Holder({ i }: { i: LegalInfo }) {
  const rows: [string, string][] = [
    ["Titular", i.legalName],
    ["Nombre comercial", i.name !== i.legalName ? i.name : ""],
    ["NIF/CIF", i.taxId],
    ["Domicilio", i.address],
    ["Correo electrónico", i.email],
    ["Teléfono", i.phone],
    ["Sitio web", "creatuburger.com"],
  ];
  return (
    <dl className="legal-holder">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export const contact = (i: LegalInfo) => (i.email ? <a href={`mailto:${i.email}`}>{i.email}</a> : "el correo de contacto del local");

export const LEGAL_LINKS = [
  { href: "/alergenos", label: "Alérgenos" },
  { href: "/condiciones", label: "Condiciones de venta" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/cookies", label: "Cookies" },
  { href: "/aviso-legal", label: "Aviso legal" },
] as const;

export function LegalNav() {
  return (
    <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-gold">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
