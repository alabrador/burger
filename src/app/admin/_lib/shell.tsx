"use client";

import {
  ChefHat,
  CircleUser,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ScanLine,
  ScrollText,
  Settings,
  TicketPercent,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BurgerMark } from "@/components/Brand";
import { api, ROLE, setCsrf } from "./api";
import { cx, ToastProvider } from "./ui";

export type Me = { id: string; email: string; name: string; role: string; csrf: string; totpEnabled: boolean; perms: string[] };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, perm: "dashboard" },
  { href: "/admin/pedidos", label: "Pedidos", icon: ReceiptText, perm: "orders.view" },
  { href: "/admin/cocina", label: "Cocina", icon: ChefHat, perm: "orders.view" },
  { href: "/admin/escanear", label: "Escanear QR", icon: ScanLine, perm: "orders.update" },
  { href: "/admin/productos", label: "Productos", icon: Package, perm: "orders.view" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, perm: "customers.view" },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard, perm: "payments.view" },
  { href: "/admin/cupones", label: "Cupones", icon: TicketPercent, perm: "coupons.edit" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, perm: "settings.edit" },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog, perm: "users.manage" },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, perm: "audit.view" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    api<Me>("/api/admin/me").then((m) => {
      setCsrf(m.csrf);
      setMe(m);
      // la cocina y la caja no tienen resumen: los llevamos a su pantalla
      if (location.pathname === "/admin" && !m.perms.includes("dashboard")) location.replace(m.role === "kitchen" ? "/admin/cocina" : "/admin/pedidos");
    });
  }, []);

  const logout = async () => {
    await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/admin/login";
  };

  if (!me)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        <span className="animate-pulse">Cargando panel…</span>
      </div>
    );

  const nav = NAV.filter((n) => me.perms.includes(n.perm));
  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link href="/admin" className="mb-3 flex items-center gap-2 px-2 py-1">
        <BurgerMark className="size-7" />
        <span className="font-display text-sm font-extrabold">
          Crea tu Burger <span className="font-sans font-medium text-muted">· Admin</span>
        </span>
      </Link>
      {nav.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
              active ? "bg-gold/12 font-semibold text-gold" : "text-muted hover:bg-panel-2 hover:text-ink",
            )}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-line pt-3">
        <Link href="/admin/cuenta" className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-panel-2", path.startsWith("/admin/cuenta") ? "text-gold" : "text-muted")}>
          <CircleUser className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ink">{me.name}</span>
            <span className="block text-[11px]">{ROLE[me.role]}</span>
          </span>
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-panel-2 hover:text-ink">
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <MeCtx.Provider value={me}>
      <ToastProvider>
        <div className="flex min-h-dvh">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-panel lg:block">{sidebar}</aside>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button aria-label="Cerrar menú" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
              <aside className="relative h-full w-64 border-r border-line bg-panel">
                <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute top-3 right-3 text-muted">
                  <X className="size-5" />
                </button>
                {sidebar}
              </aside>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur lg:hidden">
              <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="rounded-md p-1 text-muted hover:text-ink">
                <Menu className="size-5" />
              </button>
              <BurgerMark className="size-6" />
              <span className="font-display text-sm font-extrabold">Admin</span>
            </header>
            <main className="mx-auto w-full max-w-[1400px] p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </MeCtx.Provider>
  );
}
