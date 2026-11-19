import Link from "next/link";
import { BurgerMark } from "@/components/Brand";

export const metadata = { title: "Página no encontrada", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-ink">
      <div className="w-full max-w-md text-center">
        <BurgerMark className="mx-auto mb-6 size-16 opacity-90" />
        <p className="font-display text-6xl text-gold">404</p>
        <h1 className="mt-2 font-display text-3xl tracking-wide uppercase">Esta página no está en la carta</h1>
        <p className="mt-3 text-muted">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <Link href="/" className="mt-8 inline-flex items-center justify-center rounded-full bg-gold px-6 py-3 font-semibold text-char hover:bg-gold-2">
          Crear mi burger
        </Link>
      </div>
    </main>
  );
}
