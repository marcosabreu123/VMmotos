import type { Metadata, Viewport } from "next";
import { Geist, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { nicho } from "@/config/nicho";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Condensada e pesada, na linha da logo da VM. O corpo do texto continua na
// Geist: quem opera o sistema não é técnico, e legibilidade vale mais que
// estilo fora dos títulos.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-display-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${nicho.negocio.nome} — Estoque`,
  description: `Controle de estoque, vendas e fluxo de caixa da ${nicho.negocio.nome}.`,
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
