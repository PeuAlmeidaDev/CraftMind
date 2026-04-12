"use client";

import Image from "next/image";
import { getHouseAssets } from "@/lib/houses/house-assets";
import type { HouseName } from "@/types/house";

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

type Props = {
  houseName: string;
};

export default function HouseBanner({ houseName }: Props) {
  const assets = getHouseAssets(houseName as HouseName);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 p-4"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Brilho animado que percorre o vidro */}
      <div
        className="pointer-events-none absolute -inset-full"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)",
          animation: "glassShine 4s ease-in-out infinite",
        }}
      />

      {/* Bandeira */}
      <div className="relative flex flex-col items-center gap-3">
        <Image
          src={assets.bandeira}
          alt={`Bandeira ${HOUSE_DISPLAY[houseName] ?? houseName}`}
          width={180}
          height={300}
          className="drop-shadow-lg transition-transform duration-500 group-hover:scale-105"
          style={{ objectFit: "contain", maxHeight: "280px", width: "auto" }}
        />

        <button
          disabled
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold tracking-widest text-white/40 transition-colors"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
          title="Em breve"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {HOUSE_DISPLAY[houseName] ?? houseName}
        </button>
      </div>

      {/* Keyframes inline */}
      <style jsx>{`
        @keyframes glassShine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
