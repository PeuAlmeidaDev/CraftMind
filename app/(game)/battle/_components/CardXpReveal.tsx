"use client";

import Image from "next/image";
import type { CardRarity } from "@/types/cards";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type CardXpGainedInfo = {
  cardId: string;
  cardName: string;
  rarity: CardRarity;
  xp: number;
  newLevel: number;
  leveledUp: boolean;
  mob: {
    name: string;
    imageUrl: string | null;
  };
};

type Props = {
  info: CardXpGainedInfo;
  onContinue: () => void;
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

// ---------------------------------------------------------------------------
// CardXpReveal
// ---------------------------------------------------------------------------

export default function CardXpReveal({ info, onContinue }: Props) {
  const rarityClass = RARITY_CLASS[info.rarity];

  return (
    <div
      className={`fixed inset-0 z-[60] grid place-items-center p-6 ${rarityClass}`}
      style={{
        background: "rgba(3, 2, 8, 0.9)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "modalFade 400ms ease-out",
      }}
    >
      <div
        className="relative mx-4 flex w-full max-w-[420px] flex-col items-center gap-5 text-center"
        style={{
          padding: "36px 28px 28px",
          background:
            "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--rarity-color)",
          boxShadow:
            "0 30px 70px var(--bg-primary), 0 0 50px var(--rarity-glow), inset 0 0 40px color-mix(in srgb, var(--rarity-color) 8%, transparent)",
          animation: "xpRevealPop 420ms cubic-bezier(.2,1.2,.3,1)",
        }}
      >
        {/* Imagem do mob */}
        <div
          className="relative h-[120px] w-[120px] overflow-hidden rounded-full"
          style={{
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: "var(--rarity-color)",
            boxShadow: "0 0 24px var(--rarity-glow)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 28%, transparent), color-mix(in srgb, var(--bg-primary) 80%, transparent))",
          }}
        >
          {info.mob.imageUrl ? (
            <Image
              src={info.mob.imageUrl}
              alt={info.mob.name}
              fill
              sizes="120px"
              className="object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 48,
                color: "var(--rarity-color)",
              }}
            >
              {info.mob.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Eyebrow */}
        <span
          className="text-[10px] uppercase tracking-[0.4em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Cristal Aprimorado
        </span>

        {/* Nome do cristal */}
        <h2
          className="text-[36px] font-medium leading-tight text-white"
          style={{
            fontFamily: "var(--font-cormorant)",
            textShadow: "0 0 12px var(--rarity-glow)",
            marginTop: "-8px",
          }}
        >
          {info.cardName}
        </h2>

        {/* +XP gigante */}
        <div
          className="text-[64px] font-medium leading-none"
          style={{
            fontFamily: "var(--font-cormorant)",
            color: "var(--rarity-color)",
            textShadow: "0 0 18px var(--rarity-glow)",
          }}
        >
          +{info.xp} XP
        </div>

        {/* Level info */}
        {info.leveledUp ? (
          <div
            className="px-4 py-2 text-[11px] uppercase tracking-[0.35em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--ember)",
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 22%, transparent), color-mix(in srgb, var(--ember) 22%, transparent))",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--ember)",
              boxShadow:
                "0 0 18px color-mix(in srgb, var(--ember) 40%, transparent)",
              animation: "xpLevelUpPulse 1.6s ease-in-out infinite",
            }}
          >
            Level Up! Lv {info.newLevel}
          </div>
        ) : (
          <p
            className="text-[12px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            Lv {info.newLevel}
          </p>
        )}

        {/* Botao */}
        <button
          type="button"
          onClick={onContinue}
          className="mt-2 w-full cursor-pointer py-[12px] text-[11px] uppercase tracking-[0.35em] text-white transition-transform duration-150 hover:-translate-y-px"
          style={{
            fontFamily: "var(--font-cinzel)",
            background:
              "linear-gradient(135deg, var(--accent-primary), var(--ember))",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--ember)",
            boxShadow:
              "0 0 18px color-mix(in srgb, var(--ember) 40%, transparent)",
          }}
        >
          Continuar
        </button>
      </div>

      <style jsx>{`
        @keyframes xpRevealPop {
          0%   { transform: scale(0.85); opacity: 0; }
          60%  { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes xpLevelUpPulse {
          0%, 100% {
            box-shadow: 0 0 18px color-mix(in srgb, var(--ember) 40%, transparent);
          }
          50% {
            box-shadow: 0 0 28px color-mix(in srgb, var(--ember) 65%, transparent);
          }
        }
      `}</style>
    </div>
  );
}
