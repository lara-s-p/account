import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Account · Known Online", template: "%s · Account Known" },
  description: "Clientes, reuniones, tareas y estado de cartera del área de Account MKT.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={figtree.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
