"use client";

// ShowcaseSlot — Visual de uma slot da vitrine de cristais.
//
// - Slot vazio: borda tracejada com label "Slot livre".
// - Slot preenchido: arte do mob/carta + nome + raridade + badge purity.
//   Espectrais (purity === 100) ganham glow dourado animado e leve particula.
//   Quando `cardArtUrlSpectral` esta presente, usa essa imagem direto;
//   caso contrario, fallback CSS holografico (hue-rotate + saturate) sobre
//   `cardArtUrl` ou imagem do mob.

import Image from "next/image";
import type { CardRarity, UserCardSummary } from "@/types/cards";
import { isSpectral } from "@/lib/cards/purity";

type Props = {
  card: UserCardSummary | null;
  index: number;
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

export default function ShowcaseSlot({ card, index }: Props) {
  if (!card) {
    return (
      <div
        className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-2"
        style={{
          background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
          border: "1px dashed color-mix(in srgb, var(--gold) 25%, transparent)",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 45%, transparent)",
          }}
        >
          Slot {index + 1}
        </span>
        <span
          className="text-[9px] italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 35%, transparent)",
          }}
        >
          Slot livre
        </span>
      </div>
    );
  }

  const spectral = isSpectral(card.purity);
  const rarityClass = RARITY_CLASS[card.card.rarity];

  // Decisao da arte: prioridade cardArtUrlSpectral (se Espectral) > cardArtUrl > mob.imageUrl.
  // Quando usamos a imagem do mob ou cardArtUrl como fallback de Espectral,
  // aplicamos filter CSS holografico para diferenciar do estado normal.
  const altSpectral = spectral ? card.card.cardArtUrlSpectral ?? null : null;
  const baseImage = card.card.cardArtUrl ?? card.card.mob.imageUrl;
  const imageUrl = altSpectral ?? baseImage ?? null;
  const useHoloFallback = spectral && altSpectral === null && imageUrl !== null;

  return (
    <div
      className={`group relative aspect-[3/4] w-full overflow-hidden ${rarityClass} rarity-border ${spectral ? "spectral-glow" : ""}`}
      style={{
        background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      {/* Particula dourada (so Espectral) */}
      {spectral && <span aria-hidden="true" className="spectral-particle" />}

      {/* Imagem (mob/card art) */}
      <div className="relative h-[60%] w-full overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={card.card.mob.name}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            className={useHoloFallback ? "object-cover spectral-holo-filter" : "object-cover"}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 30%, transparent), color-mix(in srgb, var(--bg-primary) 80%, transparent))",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
              fontFamily: "var(--font-cormorant)",
              fontSize: 32,
            }}
          >
            {card.card.mob.name.charAt(0)}
          </div>
        )}

        {/* Gradient embaixo da imagem */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg-primary) 95%, transparent))",
          }}
        />
      </div>

      {/* Conteudo textual */}
      <div className="relative flex h-[40%] flex-col gap-1 px-2 py-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--rarity-color)",
            }}
          >
            {RARITY_LABEL[card.card.rarity]}
          </span>
          <span
            className="text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: spectral
                ? "var(--gold)"
                : "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            Lv {card.level} &middot; {card.purity}%
          </span>
        </div>
        <span
          className="truncate text-[14px] font-medium leading-tight text-white"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          {card.card.mob.name}
        </span>
        {spectral && (
          <span
            className="mt-auto text-[9px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--gold)",
              textShadow: "0 0 6px var(--gold)",
            }}
          >
            Espectral
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes spectralGlowPulse {
          0%,
          100% {
            box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 30%, transparent),
              0 0 18px color-mix(in srgb, var(--gold) 25%, transparent);
          }
          50% {
            box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 55%, transparent),
              0 0 28px color-mix(in srgb, var(--gold) 40%, transparent);
          }
        }
        @keyframes spectralHoloShift {
          0% {
            filter: hue-rotate(0deg) saturate(1.3) brightness(1.05);
          }
          100% {
            filter: hue-rotate(360deg) saturate(1.3) brightness(1.05);
          }
        }
        @keyframes spectralParticleFloat {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          100% {
            transform: translateY(-40px) scale(0.6);
            opacity: 0;
          }
        }
        :global(.spectral-glow) {
          animation: spectralGlowPulse 2.4s ease-in-out infinite;
        }
        :global(.spectral-holo-filter) {
          animation: spectralHoloShift 6s linear infinite;
          will-change: filter;
        }
        :global(.spectral-particle) {
          position: absolute;
          right: 12px;
          top: 65%;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--gold);
          box-shadow: 0 0 10px var(--gold), 0 0 20px var(--gold);
          animation: spectralParticleFloat 2.8s ease-in-out infinite;
          z-index: 5;
        }
      `}</style>
    </div>
  );
}
