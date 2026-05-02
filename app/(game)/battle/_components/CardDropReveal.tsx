"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CardRarity } from "@/types/cards";
import { isSpectral } from "@/lib/cards/purity";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DroppedCard = {
  id: string;
  name: string;
  flavorText: string;
  rarity: CardRarity;
  /** Purity rolada no drop (0-100). Opcional para retrocompat. */
  purity?: number;
  mob: {
    id: string;
    name: string;
    tier: number;
    imageUrl: string | null;
  };
};

type Props = {
  card: DroppedCard;
  onContinue: () => void;
};

const RARITY_LABEL: Record<CardRarity, string> = {
  COMUM: "Comum",
  INCOMUM: "Incomum",
  RARO: "Raro",
  EPICO: "Epico",
  LENDARIO: "Lendario",
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

const PARTICLES_BY_RARITY: Record<CardRarity, number> = {
  COMUM: 8,
  INCOMUM: 12,
  RARO: 18,
  EPICO: 26,
  LENDARIO: 36,
};

// ---------------------------------------------------------------------------
// CardDropReveal
// ---------------------------------------------------------------------------

type Phase = "FRAGMENT" | "MATERIALIZE" | "REVEALED";

export default function CardDropReveal({ card, onContinue }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("FRAGMENT");

  const rarityClass = RARITY_CLASS[card.rarity];
  const particleCount = PARTICLES_BY_RARITY[card.rarity];

  useEffect(() => {
    // Sequencia: 0ms FRAGMENT -> 1100ms MATERIALIZE -> 2400ms REVEALED
    const t1 = setTimeout(() => setPhase("MATERIALIZE"), 1100);
    const t2 = setTimeout(() => setPhase("REVEALED"), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  function handleExamine() {
    router.push("/bestiary");
  }

  return (
    <div
      className={`fixed inset-0 z-[60] grid place-items-center p-6 ${rarityClass}`}
      style={{
        background: "rgba(3, 2, 8, 0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "modalFade 500ms ease-out",
      }}
    >
      {/* Particulas decorativas (sobem) */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const left = (i / particleCount) * 100;
        const dx = ((i % 5) - 2) * 18;
        const delay = (i % 6) * 0.18;
        const duration = 4 + (i % 4);
        const size = card.rarity === "LENDARIO" ? 3 : 2;
        return (
          <span
            key={i}
            className="pointer-events-none absolute bottom-0 rounded-full"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: "var(--rarity-color)",
              boxShadow: "0 0 8px var(--rarity-glow)",
              animation: `emberDrift ${duration}s ${delay}s ease-out infinite`,
              ["--dx" as string]: `${dx}px`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Container central */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Fragmento lunar (FRAGMENT phase) */}
        {phase === "FRAGMENT" && (
          <div
            className="relative"
            style={{
              animation: "fragmentDescend 1100ms cubic-bezier(.2,1.2,.3,1) forwards",
            }}
          >
            <svg width="120" height="120" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="moonFrag" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f4f6fb" />
                  <stop offset="50%" stopColor="#cdd5e3" />
                  <stop offset="100%" stopColor="#7d8aa0" />
                </linearGradient>
                <filter id="frag-glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <polygon
                points="60,8 88,38 100,76 72,108 38,104 12,72 22,30"
                fill="url(#moonFrag)"
                filter="url(#frag-glow)"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
              />
              {/* Reflexos internos */}
              <polyline
                points="40,20 56,56 38,90"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1"
              />
            </svg>
          </div>
        )}

        {/* Cristal materializando + revelado */}
        {(phase === "MATERIALIZE" || phase === "REVEALED") && (
          <div
            className="relative"
            style={{
              animation:
                phase === "MATERIALIZE"
                  ? "crystalMaterialize 1300ms cubic-bezier(.2,1.2,.3,1) forwards"
                  : undefined,
            }}
          >
            {/* Card holografico */}
            <div
              className={`relative aspect-[3/4] w-[260px] overflow-hidden ${rarityClass} rarity-border`}
              style={{
                background:
                  "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
                borderWidth: "2px",
                borderStyle: "solid",
                boxShadow:
                  "0 0 40px var(--rarity-glow), 0 30px 60px var(--bg-primary)",
              }}
            >
              {/* Foil holografico */}
              <div className="card-foil" />

              {/* Flash overlay (so na materialize) */}
              {phase === "MATERIALIZE" && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(255,255,255,0.85), transparent 70%)",
                    animation: "crystalFlash 600ms ease-out forwards",
                  }}
                />
              )}

              {/* Imagem do mob */}
              <div className="relative h-[60%] w-full overflow-hidden">
                {card.mob.imageUrl ? (
                  <Image
                    src={card.mob.imageUrl}
                    alt={card.mob.name}
                    fill
                    sizes="260px"
                    className="object-cover"
                    style={{
                      filter:
                        "drop-shadow(0 6px 12px var(--bg-primary)) drop-shadow(0 0 14px var(--rarity-glow))",
                    }}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 30%, transparent), color-mix(in srgb, var(--bg-primary) 80%, transparent))",
                      fontFamily: "var(--font-cormorant)",
                      fontSize: 60,
                      color: "var(--rarity-color)",
                    }}
                  >
                    {card.mob.name.charAt(0)}
                  </div>
                )}
                {/* Reflexo embaixo */}
                <div
                  className="pointer-events-none absolute -bottom-1 left-0 right-0 h-1/3"
                  style={{
                    backgroundImage:
                      "linear-gradient(to bottom, color-mix(in srgb, var(--rarity-color) 18%, transparent), transparent)",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg-primary) 95%, transparent))",
                  }}
                />
              </div>

              {/* Texto */}
              <div className="relative flex h-[40%] flex-col items-center justify-center gap-1.5 px-3 py-3 text-center">
                <span
                  className="text-[8px] uppercase tracking-[0.35em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  }}
                >
                  Cristal de Memoria
                </span>
                <span
                  className="text-[18px] font-medium leading-tight text-white"
                  style={{ fontFamily: "var(--font-cormorant)" }}
                >
                  {card.mob.name}
                </span>
                <span
                  className="text-[10px] uppercase tracking-[0.4em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "var(--rarity-color)",
                    textShadow: "0 0 8px var(--rarity-glow)",
                  }}
                >
                  {RARITY_LABEL[card.rarity]}
                </span>
                {card.purity !== undefined && (
                  <span
                    className="px-2 py-0.5 text-[8px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: isSpectral(card.purity)
                        ? "#f4c45a"
                        : card.purity >= 95
                          ? "#b06bff"
                          : card.purity >= 90
                            ? "#6b9dff"
                            : card.purity >= 70
                              ? "#6bd47a"
                              : "#9ba3ad",
                      border: `1px solid ${
                        isSpectral(card.purity)
                          ? "#f4c45a"
                          : card.purity >= 95
                            ? "#b06bff"
                            : card.purity >= 90
                              ? "#6b9dff"
                              : card.purity >= 70
                                ? "#6bd47a"
                                : "#9ba3ad"
                      }`,
                      boxShadow: isSpectral(card.purity)
                        ? "0 0 12px #f4c45a"
                        : undefined,
                    }}
                    aria-label={`Pureza ${card.purity}${isSpectral(card.purity) ? " - Cristal Espectral" : ""}`}
                  >
                    {isSpectral(card.purity) ? "100% ESPECTRAL" : `${card.purity}% PURO`}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Texto de revelacao */}
        {phase === "REVEALED" && (
          <div
            className="flex flex-col items-center gap-1 text-center"
            style={{ animation: "revealText 600ms ease-out forwards" }}
          >
            <p
              className="text-[14px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                maxWidth: "320px",
              }}
            >
              &laquo; {card.flavorText} &raquo;
            </p>
          </div>
        )}

        {/* Botoes */}
        {phase === "REVEALED" && (
          <div
            className="mt-2 flex gap-3"
            style={{ animation: "revealText 600ms 200ms ease-out backwards" }}
          >
            <button
              type="button"
              onClick={handleExamine}
              className="cursor-pointer px-5 py-3 text-[10px] uppercase tracking-[0.35em] text-white transition-transform duration-150 hover:-translate-y-px"
              style={{
                fontFamily: "var(--font-cinzel)",
                background: "linear-gradient(135deg, var(--accent-primary), var(--ember))",
                border: "1px solid var(--ember)",
                boxShadow: "0 0 18px var(--rarity-glow)",
              }}
            >
              Examinar
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="cursor-pointer px-5 py-3 text-[10px] uppercase tracking-[0.3em] transition-colors hover:text-white"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                background: "transparent",
                border: "1px solid color-mix(in srgb, var(--gold) 27%, transparent)",
              }}
            >
              Continuar
            </button>
          </div>
        )}
      </div>

      {/* Keyframes locais (especificos do reveal) */}
      <style jsx>{`
        @keyframes fragmentDescend {
          0%   { transform: translateY(-220px) rotate(-180deg) scale(0.4); opacity: 0; filter: brightness(2); }
          40%  { opacity: 1; }
          100% { transform: translateY(0) rotate(360deg) scale(1); opacity: 1; filter: brightness(1.5); }
        }
        @keyframes crystalMaterialize {
          0%   { transform: scale(0.4); opacity: 0; filter: blur(6px) brightness(2); }
          50%  { transform: scale(1.06); opacity: 1; filter: blur(0) brightness(1.3); }
          100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
        }
        @keyframes crystalFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes revealText {
          0%   { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
