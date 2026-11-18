import type { Metadata } from "next";
export const metadata: Metadata = { title: "Tu pedido · Crea tu Burger", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function L({ children }: { children: React.ReactNode }) {
  return children;
}
