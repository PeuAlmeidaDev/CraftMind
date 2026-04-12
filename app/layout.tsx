import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cinzel",
});

export const metadata: Metadata = {
  title: "Craft Mind",
  description: "RPG de batalha por turnos alimentado por hábitos reais",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.className} ${cinzel.variable}`}>
      <body className="min-h-screen bg-[var(--bg-primary)] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
