import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

/** Tipografía de marca: Anton para titulares e impacto, Inter para texto e información. */
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE = (process.env.APP_BASE_URL || "https://creatuburger.com").replace(/\/$/, "");
const DESCRIPTION =
  "Crea tu hamburguesa a tu gusto y mira cómo se arma en 3D, capa a capa: carne Angus o pollo, quesos, vegetales, salsas y extras. Pide online y recoge en el local.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Crea tu Burger · Hamburguesas a tu gusto en 3D", template: "%s · Crea tu Burger" },
  description: DESCRIPTION,
  applicationName: "Crea tu Burger",
  keywords: ["hamburguesas", "hamburguesa personalizada", "crea tu hamburguesa", "burger", "Angus", "pedir hamburguesa online", "recoger en el local"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Crea tu Burger",
    url: "/",
    title: "Crea tu Burger · Hamburguesas a tu gusto en 3D",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Crea tu Burger · Hamburguesas a tu gusto en 3D", description: DESCRIPTION },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#120d0b", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${anton.variable} ${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
