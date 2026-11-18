import type { Metadata } from "next";
import { Shell } from "../_lib/shell";

export const metadata: Metadata = { title: "Admin · Crea tu Burger", robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
