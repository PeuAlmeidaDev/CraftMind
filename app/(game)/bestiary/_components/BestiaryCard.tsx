"use client";

import Image from "next/image";
import type { BestiaryEntry, BestiaryCardInfo, CardRarity } from "@/types/cards";
import { BestiaryUnlockTier } from "@/types/cards";

type Props = {
  entry: BestiaryEntry;
  /** Abre o modal do mob. Se `card` vier, abre direto na variante selecionada. */
  onSelect: (card: BestiaryCardInfo | null) => void;
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

const RARITY_LABEL: Record<CardRarity, string> = {
  COMUM: "Comum",
  INCOMUM: "Incomum",
  RARO: "Raro",
  EPICO: "Epico",
  LENDARIO: "Lendario",
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

const STAR_LABEL: Record<number, string> = {
  1: "★",
  2: "★★",
  3: "★★★",
};

const MAX_VARIANT_SLOTS = 3;

export default function BestiaryCard({ entry, onSelect }: Props) {
  const isUndiscovered = entry.unlockTier === BestiaryUnlockTier.UNDISCOVERED;
  const isMastered = entry.unlockTier === BestiaryUnlockTier.MASTERED;

  // Borda colorida: prioridade para a melhor raridade coletada, senao tier do mob.
  const ownedCards = entry.cards.filter((c) => c.hasCard);
  const highlightRarity: CardRarity | null =
    ownedCards.length > 0 ? ownedCards[ownedCards.length - 1].rarity : null;
  const tierColor =
    entry.tier !== null ? TIER_COLORS[entry.tier] ?? TIER_COLORS[1] : "#3a3a4a";
  const rarityClass = highlightRarity ? RARITY_CLASS[highlightRarity] : "";
  const accentColor = highlightRarity ? "var(--rarity-color)" : tierColor;

  // Capa do card do mob: a primeira variante coletada (ou a primeira cadastrada).
  const coverCard = ownedCards[0] ?? null;
  const coverArt = coverCard?.cardArtUrl ?? entry.imageUrl;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden text-left transition-transform duration-300 ${rarityClass}`}
      style={{
        background:
          "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
        border: `1px solid ${isUndiscovered ? "color-mix(in srgb, var(--gold) 12%, transparent)" : accentColor}`,
        boxShadow: isMastered
          ? "0 0 18px rgba(244, 196, 90, 0.5), inset 0 0 14px rgba(244, 196, 90, 0.2)"
          : undefined,
      }}
    >
      {/* CABEÇALHO — Imagem do mob + overlays + nome (clicavel para abrir o modal sem variante) */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-label={`Ver detalhes de ${entry.name ?? "criatura desconhecida"}`}
        className="relative aspect-[3/4] w-full cursor-pointer overflow-hidden text-left"
      >
        {/* CAMADA 1 — Imagem full art como background */}
        {!isUndiscovered && coverArt ? (
          <Image
            src={coverArt}
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

        {/* CAMADA 2 — Gradiente escuro para legibilidade do texto */}
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

        {/* CAMADA 6 — Overlay bottom: Nome + contador de vitorias */}
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

      {/* GALERIA DE VARIANTES — sempre 3 slots para alinhamento consistente. */}
      {!isUndiscovered && (
        <div
          className="grid grid-cols-3 gap-1.5 border-t p-2"
          style={{
            borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
            background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
          }}
        >
          {Array.from({ length: MAX_VARIANT_SLOTS }, (_, i) => i + 1).map(
            (stars) => {
              const variant = entry.cards.find((c) => c.requiredStars === stars);
              return (
                <VariantSlot
                  key={stars}
                  stars={stars}
                  variant={variant ?? null}
                  mobImageUrl={entry.imageUrl}
                  onClick={(c) => onSelect(c)}
                />
              );
            },
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// VariantSlot — slot quadrado para uma variante (1, 2 ou 3 estrelas)
// ---------------------------------------------------------------------------

function VariantSlot({
  stars,
  variant,
  mobImageUrl,
  onClick,
}: {
  stars: number;
  variant: BestiaryCardInfo | null;
  mobImageUrl: string | null;
  onClick: (variant: BestiaryCardInfo) => void;
}) {
  const starsLabel = STAR_LABEL[stars] ?? "★";

  // Caso 1: variante inexistente — slot vazio nao-clicavel.
  if (!variant) {
    return (
      <div
        aria-label={`Variante ${starsLabel} nao cadastrada`}
        className="flex aspect-square flex-col items-center justify-center gap-0.5"
        style={{
          background: "rgba(39, 39, 42, 0.4)", // bg-zinc-800/40
          border: "1px dashed color-mix(in srgb, var(--gold) 12%, transparent)",
        }}
      >
        <span
          className="text-[10px] tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 28%, transparent)",
          }}
        >
          {starsLabel}
        </span>
        <span
          className="text-[14px] leading-none"
          style={{
            fontFamily: "var(--font-mono)",
            color: "color-mix(in srgb, var(--gold) 35%, transparent)",
          }}
        >
          —
        </span>
      </div>
    );
  }

  const rarityClass = RARITY_CLASS[variant.rarity];
  const isOwned = variant.hasCard;
  const ariaLabel = isOwned
    ? `Variante ${starsLabel} ${RARITY_LABEL[variant.rarity]} coletada`
    : `Variante ${starsLabel} nao coletada — derrote a versao ${stars} estrelas para coletar`;
  const slotArt = variant.cardArtUrl ?? mobImageUrl;

  return (
    <button
      type="button"
      onClick={() => onClick(variant)}
      aria-label={ariaLabel}
      className={`group/slot relative flex aspect-square flex-col overflow-hidden text-left transition-transform ${rarityClass}`}
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: `1px solid ${isOwned ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 18%, transparent)"}`,
      }}
    >
      {/* Arte da variante (se cadastrada) — silhueta cinza quando nao coletada. */}
      {isOwned && slotArt ? (
        <Image
          src={slotArt}
          alt=""
          fill
          sizes="(max-width: 640px) 16vw, 80px"
          className="object-cover"
          style={{ filter: "brightness(0.92)" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-secondary) 70%, transparent) 0%, var(--bg-primary) 90%)",
            fontFamily: "var(--font-cormorant)",
            fontSize: 28,
            color: "color-mix(in srgb, var(--gold) 35%, transparent)",
            filter: "grayscale(1)",
          }}
        >
          ?
        </div>
      )}

      {/* Cadeado quando nao coletada */}
      {!isOwned && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="flex h-7 w-7 items-center justify-center"
            style={{
              background: "rgba(8, 6, 14, 0.78)",
              border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
              color: "color-mix(in srgb, var(--gold) 75%, transparent)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        </div>
      )}

      {/* Label de estrelas no topo */}
      <span
        className="absolute left-1 top-1 z-[2] px-1 text-[8px] tracking-[0.15em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: isOwned ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 65%, transparent)",
          background: "rgba(8, 6, 14, 0.72)",
        }}
      >
        {starsLabel}
      </span>

      {/* Chip de raridade no rodape (so quando coletada, para nao spoilar) */}
      {isOwned && (
        <span
          className="absolute bottom-1 right-1 z-[2] px-1 py-px text-[7px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "var(--rarity-color)",
            background: "rgba(8, 6, 14, 0.78)",
            border: "1px solid var(--rarity-color)",
          }}
        >
          {RARITY_LABEL[variant.rarity]}
        </span>
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
