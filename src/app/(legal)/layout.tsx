import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Brand";
import { LegalNav } from "./legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-[linear-gradient(180deg,#1f1613_0%,#140e0c_100%)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 lg:h-16">
          <Logo compact />
          <Link href="/" className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] shrink-0 px-3.5 py-2 text-sm font-semibold hover:border-gold/50">
            <ArrowLeft className="size-4" /> <span className="max-[359px]:hidden">Crear mi burger</span>
            <span className="min-[360px]:hidden">Volver</span>
          </Link>
        </div>
        <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(227,38,27,0.9)_15%,#ffc21a_50%,rgba(227,38,27,0.9)_85%,transparent)]" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:py-12">{children}</main>
      <footer className="border-t border-line px-4 py-6">
        <LegalNav />
      </footer>
    </div>
  );
}
