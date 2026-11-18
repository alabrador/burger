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
  Tags,
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
  {
    group: "Resumen",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" }],
  },
  {
    group: "Operación",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: ReceiptText, perm: "orders.view" },
      { href: "/admin/cocina", label: "Cocina", icon: ChefHat, perm: "orders.view" },
      { href: "/admin/escanear", label: "Escanear QR", icon: ScanLine, perm: "orders.update" },
      { href: "/admin/clientes", label: "Clientes", icon: Users, perm: "customers.view" },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { href: "/admin/productos", label: "Productos", icon: Package, perm: "orders.view" },
      { href: "/admin/categorias", label: "Categorías", icon: Tags, perm: "products.edit" },
      { href: "/admin/cupones", label: "Cupones", icon: TicketPercent, perm: "coupons.edit" },
    ],
  },
  {
    group: "Ajustes",
    items: [
      { href: "/admin/pagos", label: "Pagos", icon: CreditCard, perm: "payments.view" },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings, perm: "settings.edit" },
      { href: "/admin/usuarios", label: "Usuarios", icon: UserCog, perm: "users.manage" },
      { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, perm: "audit.view" },
    ],
  },
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
      <div className="admin-ui grid min-h-dvh place-items-center text-sm text-muted">
        <span className="flex items-center gap-2 animate-pulse">
          <BurgerMark className="h-7 w-9" /> Cargando panel…
        </span>
      </div>
    );

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => me.perms.includes(n.perm)) })).filter((g) => g.items.length);
  const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition";
  const sidebar = (
    <nav className="flex h-full flex-col bg-char text-white">
      <div className="brand-stripe h-[3px] shrink-0" />
      <Link href="/admin" className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold shadow-[0_8px_20px_-10px_rgb(255_194_26/0.9)]">
          <BurgerMark className="h-7 w-9" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[15px] font-black uppercase italic tracking-tight">Crea tu Burger</span>
          <span className="block text-xs font-medium text-gold">{ROLE[me.role]}</span>
        </span>
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-color:#3a332d_transparent]">
        {groups.map((g) => (
          <div key={g.group} className="mt-4">
            <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/40">{g.group}</div>
            {g.items.map((n) => {
              const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cx(item, active ? "bg-gold font-semibold text-char shadow-[0_8px_22px_-12px_rgb(255_194_26/0.9)]" : "text-white/75 hover:bg-white/[0.06] hover:text-white")}
                >
                  <n.icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <Link href="/admin/cuenta" onClick={() => setOpen(false)} className={cx(item, path.startsWith("/admin/cuenta") ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold uppercase">{me.name.slice(0, 2)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-white">{me.name}</span>
            <span className="block truncate text-[11px] text-white/50">{me.email}</span>
          </span>
          <CircleUser className="size-4 text-white/40" />
        </Link>
        <button onClick={logout} className={cx(item, "w-full text-white/75 hover:bg-white/[0.06] hover:text-white")}>
          <LogOut className="size-[18px]" strokeWidth={1.75} /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <MeCtx.Provider value={me}>
      <ToastProvider>
        <div className="admin-ui flex min-h-dvh">
          <div className="hidden w-64 shrink-0 bg-char lg:block">
            <aside className="sticky top-0 h-dvh">{sidebar}</aside>
          </div>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button aria-label="Cerrar menú" className="absolute inset-0 bg-char/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
              <aside className="relative h-full w-72 shadow-2xl">
                <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute top-5 right-3 z-10 text-white/60">
                  <X className="size-5" />
                </button>
                {sidebar}
              </aside>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex items-center gap-3 bg-char px-4 py-2.5 text-white lg:hidden">
              <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="rounded-md p-1 text-white/80 hover:text-white">
                <Menu className="size-5" />
              </button>
              <BurgerMark className="h-6 w-8" />
              <span className="font-display text-sm font-black uppercase italic">Crea tu Burger</span>
            </header>
            <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 lg:px-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </MeCtx.Provider>
  );
}
