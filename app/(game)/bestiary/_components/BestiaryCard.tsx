"use client";

import Image from "next/image";
import type { BestiaryEntry, CardRarity } from "@/types/cards";
import { BestiaryUnlockTier } from "@/types/cards";

type Props = {
  entry: BestiaryEntry;
  onClick: () => void;
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

const TIER_COLORS: Record<number, string> = {
  1: "#9ba3ad",
  2: "#6bd47a",
  3: "#6b9dff",
  4: "#b06bff",
  5: "#f4c45a",
};

const UNLOCK_LABEL: Record<BestiaryUnlockTier, string> = {
  UNDISCOVERED: "Desconhecido",
  DISCOVERED: "Descoberto",
  STUDIED: "Estudado",
  MASTERED: "Mestre",
};

export default function BestiaryCard({ entry, onClick }: Props) {
  const isUndiscovered = entry.unlockTier === BestiaryUnlockTier.UNDISCOVERED;
  const isMastered = entry.unlockTier === BestiaryUnlockTier.MASTERED;

  // Borda colorida: prioridade para raridade do cristal possuido, senao tier do mob.
  const cardRarity = entry.card.hasCard ? entry.card.rarity : null;
  const tierColor =
    entry.tier !== null ? TIER_COLORS[entry.tier] ?? TIER_COLORS[1] : "#3a3a4a";
  const rarityClass = cardRarity ? RARITY_CLASS[cardRarity] : "";
  const accentColor = cardRarity ? "var(--rarity-color)" : tierColor;

  // Fonte da imagem da carta: arte do cristal se possuido, senao foto do mob.
  const artSrc = entry.card.artUrl ?? entry.imageUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver detalhes de ${entry.name ?? "criatura desconhecida"}`}
      className={`group relative aspect-[3/4] w-full cursor-pointer overflow-hidden text-left transition-transform duration-300 ${rarityClass}`}
      style={{
        background:
          "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
        border: `1px solid ${isUndiscovered ? "color-mix(in srgb, var(--gold) 12%, transparent)" : accentColor}`,
        boxShadow: isMastered
          ? "0 0 18px rgba(244, 196, 90, 0.5), inset 0 0 14px rgba(244, 196, 90, 0.2)"
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isUndiscovered) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
    >
      {/* CAMADA 1 — Imagem full art como background */}
      {!isUndiscovered && artSrc ? (
        <Image
          src={artSrc}
          alt={entry.name ?? "Criatura"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
          className="object-cover"
          style={{ filter: "brightness(0.78)" }}
        />
      ) : isUndiscovered ? (
        <UndiscoveredSilhouette imageUrl={entry.imageUrl} />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-secondary) 70%, transparent) 0%, var(--bg-primary) 85%)",
            fontFamily: "var(--font-cormorant)",
            fontSize: 64,
            color: accentColor,
          }}
        >
          {(entry.name ?? "?").charAt(0)}
        </div>
      )}

      {/* CAMADA 2 — Gradiente escuro para legibilidade do texto (so quando descoberto+) */}
      {!isUndiscovered && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              "linear-gradient(to top, rgba(5, 3, 10, 0.92) 0%, rgba(5, 3, 10, 0.55) 22%, rgba(5, 3, 10, 0.05) 50%, rgba(5, 3, 10, 0.35) 100%)",
          }}
        />
      )}

      {/* CAMADA 3 — Foil unico varrendo na cor da casa */}
      {!isUndiscovered && <div className="card-foil" style={{ zIndex: 3 }} />}

      {/* CAMADA 4 — Overlay top: Tier + status de unlock */}
      {!isUndiscovered && (
        <div className="absolute top-2 left-2 right-2 z-[4] flex items-start justify-between gap-1">
          <span
            className="px-1.5 py-0.5 text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: tierColor,
              background: "rgba(8, 6, 14, 0.7)",
              border: `1px solid ${tierColor}80`,
              letterSpacing: "0.25em",
            }}
          >
            T{entry.tier}
          </span>
          <span
            className="px-1.5 py-0.5 text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: isMastered ? "#f4c45a" : accentColor,
              background: "rgba(8, 6, 14, 0.7)",
              border: `1px solid ${isMastered ? "rgba(244, 196, 90, 0.7)" : accentColor}`,
              letterSpacing: "0.25em",
            }}
          >
            {UNLOCK_LABEL[entry.unlockTier]}
          </span>
        </div>
      )}

      {/* CAMADA 5 — Mastery badge (estrela) no canto direito, abaixo do status */}
      {isMastered && (
        <div
          className="absolute right-2 top-9 z-[4] flex h-6 w-6 items-center justify-center"
          style={{
            color: "#f4c45a",
            background: "rgba(8, 6, 14, 0.85)",
            border: "1px solid rgba(244, 196, 90, 0.7)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18.5 21 L12 16.5 L5.5 21 L8 13.5 L2 9 L9.5 9 Z" />
          </svg>
        </div>
      )}

      {/* CAMADA 6 — Overlay bottom: Nome + linha minimalista (cristal icon + NV) */}
      {!isUndiscovered ? (
        <div className="absolute bottom-0 left-0 right-0 z-[4] flex flex-col gap-1 p-2.5">
          <div
            className="truncate text-[16px] font-medium leading-tight text-white"
            style={{
              fontFamily: "var(--font-cormorant)",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.85)",
            }}
          >
            {entry.name}
          </div>
          <div className="flex items-center gap-2">
            {entry.card.hasCard ? (
              <span
                aria-label={`Cristal ${entry.card.rarity ?? ""}`}
                className="inline-flex h-3.5 w-3.5 items-center justify-center"
                style={{
                  color: "var(--rarity-color)",
                  filter: "drop-shadow(0 0 4px var(--rarity-glow))",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  {/* Cristal estilizado (diamante alongado) */}
                  <path d="M12 2 L18 9 L12 22 L6 9 Z" />
                </svg>
              </span>
            ) : null}
            <span
              className="text-[10px] font-medium uppercase tracking-[0.2em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
              }}
            >
              {entry.victories}V
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-[4] flex flex-col items-center gap-1 p-3">
          <span
            className="text-[10px] uppercase tracking-[0.4em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 35%, transparent)",
            }}
          >
            ???
          </span>
          <span
            className="text-[9px] italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 25%, transparent)",
            }}
          >
            Ainda nao revelada
          </span>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Silhueta para entries nao descobertos
// ---------------------------------------------------------------------------

function UndiscoveredSilhouette({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background:
          "radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-secondary) 60%, transparent) 0%, var(--bg-primary) 80%)",
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt="Criatura desconhecida"
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
          style={{ filter: "brightness(0) opacity(0.55)" }}
        />
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[80px] font-medium leading-none"
          style={{
            fontFamily: "var(--font-cormorant)",
            color: "color-mix(in srgb, var(--gold) 25%, transparent)",
            textShadow:
              "0 0 12px color-mix(in srgb, var(--accent-primary) 25%, transparent)",
          }}
        >
          ?
        </span>
      </div>
    </div>
  );
}
