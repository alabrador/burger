import type { Metadata } from "next";
export const metadata: Metadata = { title: "Ticket", robots: { index: false, follow: false } };
export default function L({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
