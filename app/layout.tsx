import type { Metadata } from "next";
import { Inter, Cinzel, Cormorant_Garamond, EB_Garamond, JetBrains_Mono } from "next/font/google";
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

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-garamond",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
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
    <html lang="pt-BR" className={`${inter.className} ${cinzel.variable} ${cormorant.variable} ${ebGaramond.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[var(--bg-primary)] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
