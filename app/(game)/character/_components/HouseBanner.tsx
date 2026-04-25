"use client";

import Image from "next/image";
import { getHouseAssets } from "@/lib/houses/house-assets";
import { HOUSE_LORE } from "@/lib/constants-house";
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
  const displayName = HOUSE_DISPLAY[houseName] ?? houseName;
  const lore = HOUSE_LORE[houseName];

  return (
    <div
      className="group relative overflow-hidden border p-4"
      style={{
        background: "linear-gradient(160deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Brilho animado — mantido */}
      <div
        className="pointer-events-none absolute -inset-full"
        style={{
          background: `linear-gradient(100deg, transparent 0%, color-mix(in srgb, var(--gold) 14%, transparent) 45%, color-mix(in srgb, var(--ember) 14%, transparent) 50%, color-mix(in srgb, var(--gold) 14%, transparent) 55%, transparent 100%)`,
          animation: "glassShine 5.5s linear infinite",
        }}
      />

      {/* Conteúdo */}
      <div className="relative z-[1] flex flex-col items-center gap-2.5">
        {/* Eyebrow */}
        <span
          className="text-center text-[10px] uppercase tracking-[0.35em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Minha Casa
        </span>

        {/* Bandeira */}
        <Image
          src={assets.bandeira}
          alt={`Bandeira ${displayName}`}
          width={200}
          height={300}
          className="transition-transform duration-250 group-hover:-translate-y-0.5 group-hover:scale-[1.02]"
          style={{
            objectFit: "contain",
            maxHeight: "260px",
            width: "auto",
            filter: `drop-shadow(0 8px 14px var(--bg-primary)) drop-shadow(0 0 12px color-mix(in srgb, var(--ember) 14%, transparent))`,
          }}
        />

        {/* Nome da casa */}
        <div
          className="text-center text-base uppercase tracking-[0.4em] text-white"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          {displayName}
        </div>

        {/* Motto */}
        {lore && (
          <div
            className="text-center text-xs italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 67%, transparent)",
              textWrap: "pretty",
            }}
          >
            &laquo; {lore.motto} &raquo;
          </div>
        )}
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
