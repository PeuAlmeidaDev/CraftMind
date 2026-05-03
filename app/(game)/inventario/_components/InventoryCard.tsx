"use client";

import Image from "next/image";
import type { CardRarity, UserCardSummary } from "@/types/cards";
import { isSpectral } from "@/lib/cards/purity";

type Props = {
  userCard: UserCardSummary;
  onClick: (userCard: UserCardSummary) => void;
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

function purityBadgeLabel(purity: number): string {
  if (purity === 100) return "100% ESPECTRAL";
  return `${purity}% PURO`;
}

function purityBadgeColor(purity: number): string {
  if (purity === 100) return "#f4c45a";
  if (purity >= 95) return "#b06bff";
  if (purity >= 90) return "#6b9dff";
  if (purity >= 70) return "#6bd47a";
  if (purity >= 40) return "#9ba3ad";
  return "#7a7280";
}

/**
 * InventoryCard — celula de cartao no grid do inventario.
 *
 * Versao compacta de FilledSlot (CardSlots.tsx), sem botoes de equip/unequip.
 * Click abre modal de detalhes via callback `onClick`.
 */
export default function InventoryCard({ userCard, onClick }: Props) {
  const { card } = userCard;
  const rarityClass = RARITY_CLASS[card.rarity];
  const spectral = isSpectral(userCard.purity);
  const purityLabel = purityBadgeLabel(userCard.purity);
  const purityColor = purityBadgeColor(userCard.purity);

  return (
    <button
      type="button"
      onClick={() => onClick(userCard)}
      aria-label={`Detalhes de ${card.name}`}
      className={`group relative aspect-[3/4] w-full cursor-pointer overflow-hidden text-left transition-transform hover:-translate-y-0.5 ${rarityClass} rarity-border ${spectral ? "spectral-card-glow" : ""}`}
      style={{
        background:
          "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 0 14px var(--rarity-glow)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
      }}
    >
      {/* Foil holografico animado (mesma classe do CardSlots) */}
      <div className="card-foil" />

      {/* Particula dourada — apenas Espectral */}
      {spectral && (
        <span aria-hidden="true" className="spectral-card-particle" />
      )}

      {/* Badge level (canto superior esquerdo) */}
      <div
        className="absolute top-1.5 left-1.5 z-10 flex h-5 min-w-[22px] items-center justify-center px-1.5"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "var(--rarity-color)",
          background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)",
          border: "1px solid var(--rarity-color)",
          fontSize: 8,
          letterSpacing: "0.15em",
        }}
      >
        Lv {userCard.level}
      </div>

      {/* Badge purity */}
      <div
        className="absolute top-8 left-1.5 z-10 flex h-4 items-center justify-center px-1.5"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: purityColor,
          background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)",
          border: `1px solid ${purityColor}`,
          fontSize: 7,
          letterSpacing: "0.15em",
          boxShadow: spectral ? `0 0 10px ${purityColor}` : undefined,
        }}
        aria-label={`Pureza ${userCard.purity}${spectral ? " - Cristal Espectral" : ""}`}
      >
        {purityLabel}
      </div>

      {/* Marca EQUIPADA (canto superior direito) */}
      {userCard.equipped && userCard.slotIndex !== null && (
        <div
          className="absolute top-1.5 right-1.5 z-10 flex h-5 items-center px-1.5"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "var(--ember)",
            background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)",
            border: "1px solid var(--ember)",
            fontSize: 7,
            letterSpacing: "0.15em",
          }}
          aria-label={`Equipada no slot ${userCard.slotIndex + 1}`}
        >
          EQUIP S{userCard.slotIndex + 1}
        </div>
      )}

      {/* Imagem do mob */}
      <div className="relative h-[58%] w-full overflow-hidden">
        {card.mob.imageUrl ? (
          <Image
            src={card.mob.imageUrl}
            alt={card.mob.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            className="object-cover"
            style={{
              filter: `drop-shadow(0 4px 8px var(--bg-primary))`,
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 30%, transparent), color-mix(in srgb, var(--bg-primary) 80%, transparent))",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
              fontFamily: "var(--font-cormorant)",
              fontSize: 36,
            }}
          >
            {card.mob.name.charAt(0)}
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg-primary) 95%, transparent))",
          }}
        />
      </div>

      {/* Conteudo textual */}
      <div className="relative flex h-[42%] flex-col gap-1 px-2 py-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[8px] uppercase tracking-[0.25em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            }}
          >
            T{card.mob.tier}
          </span>
          <span
            className="text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--rarity-color)",
            }}
          >
            {RARITY_LABEL[card.rarity]}
          </span>
        </div>

        <div
          className="truncate text-[14px] font-medium leading-tight text-white"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          {card.name}
        </div>

        <div
          className="mt-auto truncate text-[10px] italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 65%, transparent)",
          }}
        >
          {card.mob.name}
        </div>
      </div>

      {/* Estilos da animacao espectral (mesmo padrao de CardSlots) */}
      <style jsx>{`
        @keyframes spectralCardGlow {
          0%,
          100% {
            box-shadow:
              0 0 8px color-mix(in srgb, var(--gold) 35%, transparent),
              0 0 18px color-mix(in srgb, var(--gold) 25%, transparent);
          }
          50% {
            box-shadow:
              0 0 14px color-mix(in srgb, var(--gold) 60%, transparent),
              0 0 28px color-mix(in srgb, var(--gold) 40%, transparent);
          }
        }
        @keyframes spectralCardParticle {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          100% {
            transform: translateY(-32px) scale(0.55);
            opacity: 0;
          }
        }
        :global(.spectral-card-glow) {
          animation: spectralCardGlow 2.4s ease-in-out infinite;
        }
        :global(.spectral-card-particle) {
          position: absolute;
          right: 8px;
          top: 65%;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--gold);
          box-shadow: 0 0 8px var(--gold);
          animation: spectralCardParticle 2.6s ease-in-out infinite;
          z-index: 5;
          pointer-events: none;
        }
      `}</style>
    </button>
  );
}
