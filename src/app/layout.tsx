import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Kaushan_Script } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const script = Kaushan_Script({ variable: "--font-kaushan", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Crea tu Burger",
  description: "Elige tus ingredientes y mira cómo se arma tu hamburguesa en 3D.",
};

export const viewport: Viewport = { themeColor: "#120d0b", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} ${inter.variable} ${script.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
