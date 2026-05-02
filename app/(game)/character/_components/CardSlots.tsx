"use client";

import Image from "next/image";
import type { CardEffect, CardRarity, UserCardSummary } from "@/types/cards";
import type { StatName } from "@/types/skill";
import { getLevelMultiplier, scaleEffectForDisplay } from "@/lib/cards/level";
import { getPurityMultiplier, isSpectral } from "@/lib/cards/purity";
import CardLevelBar from "../../_components/CardLevelBar";

// Re-export para preservar imports existentes (`import type { UserCardSummary } from "./CardSlots"`).
export type { UserCardSummary };

type Props = {
  /** Todas as UserCards do usuario (equipadas e nao equipadas). */
  userCards: UserCardSummary[];
  onSlotClick: (slotIndex: number) => void;
  onUnequip: (slotIndex: number) => void;
  /** Aberto quando o jogador clica em "Trocar skill espectral" em um cristal
   *  Espectral equipado. Recebe o `userCardId` do cristal. Pode ser omitido
   *  para esconder o botao (modo legado). */
  onSpectralSkillClick?: (userCardId: string) => void;
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

const STAT_LABEL: Record<StatName, string> = {
  physicalAtk: "ATK Fis",
  physicalDef: "DEF Fis",
  magicAtk: "ATK Mag",
  magicDef: "DEF Mag",
  hp: "HP",
  speed: "VEL",
  accuracy: "PRC",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEffect(effect: CardEffect): string | null {
  if (effect.type === "STAT_FLAT") {
    const sign = effect.value >= 0 ? "+" : "";
    return `${sign}${effect.value} ${STAT_LABEL[effect.stat]}`;
  }
  if (effect.type === "STAT_PERCENT") {
    const sign = effect.percent >= 0 ? "+" : "";
    // Arredonda em 1 casa para nao poluir com fracoes longas (ex: 8.4%, 14%).
    const rounded = Math.round(effect.percent * 10) / 10;
    return `${sign}${rounded}% ${STAT_LABEL[effect.stat]}`;
  }
  return null;
}

/** Lista de efeitos ja escalonados por purity x level, prontos para display. */
function scaledEffectsList(effects: CardEffect[], level: number, purity: number): string[] {
  return effects
    .map((e) => formatEffect(scaleEffectForDisplay(e, level, purity)))
    .filter((s): s is string => s !== null);
}

/** Label e classe para badge de purity. */
function purityBadgeLabel(purity: number): string {
  if (purity === 100) return "100% ESPECTRAL";
  return `${purity}% PURO`;
}

/** Cor do badge de purity baseado no valor (mapeia em CSS color literal). */
function purityBadgeColor(purity: number): string {
  if (purity === 100) return "#f4c45a"; // Espectral — dourado
  if (purity >= 95) return "#b06bff"; // Excelente — roxo
  if (purity >= 90) return "#6b9dff"; // Otimo — azul
  if (purity >= 70) return "#6bd47a"; // Bom — verde
  if (purity >= 40) return "#9ba3ad"; // Medio — cinza claro
  return "#7a7280"; // Lixo — cinza escuro
}

// ---------------------------------------------------------------------------
// Slot vazio
// ---------------------------------------------------------------------------

function EmptySlot({
  slotIndex,
  onClick,
}: {
  slotIndex: number;
  onClick: (slotIndex: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(slotIndex)}
      className="group relative flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-2 transition-colors"
      style={{
        background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
        border: "1px dashed color-mix(in srgb, var(--gold) 30%, transparent)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ember)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "color-mix(in srgb, var(--gold) 30%, transparent)";
      }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.3em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
        }}
      >
        Slot {slotIndex + 1}
      </span>
      <span
        className="text-3xl transition-transform group-hover:scale-110"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: "color-mix(in srgb, var(--ember) 70%, transparent)",
          lineHeight: 1,
        }}
      >
        +
      </span>
      <span
        className="text-[9px] uppercase tracking-[0.25em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 50%, transparent)",
        }}
      >
        Equipar
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slot preenchido
// ---------------------------------------------------------------------------

function FilledSlot({
  userCard,
  slotIndex,
  onChange,
  onUnequip,
  onSpectralSkillClick,
}: {
  userCard: UserCardSummary;
  slotIndex: number;
  onChange: (slotIndex: number) => void;
  onUnequip: (slotIndex: number) => void;
  onSpectralSkillClick?: (userCardId: string) => void;
}) {
  const { card } = userCard;
  const rarityClass = RARITY_CLASS[card.rarity];
  const levelMult = getLevelMultiplier(userCard.level);
  const purityMult = getPurityMultiplier(userCard.purity);
  const combined = levelMult * purityMult;
  const showMultiplier = Math.abs(combined - 1) > 0.001;
  const bonuses = scaledEffectsList(card.effects, userCard.level, userCard.purity);
  const multiplierLabel = `×${combined.toFixed(2)}`;
  const spectral = isSpectral(userCard.purity);
  const purityLabel = purityBadgeLabel(userCard.purity);
  const purityColor = purityBadgeColor(userCard.purity);

  return (
    <div
      className={`group relative aspect-[3/4] w-full overflow-hidden ${rarityClass} rarity-border ${spectral ? "spectral-card-glow" : ""}`}
      style={{
        background:
          "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
      {/* Foil holografico animado */}
      <div className="card-foil" />

      {/* Particula dourada sutil — apenas Espectral */}
      {spectral && (
        <span aria-hidden="true" className="spectral-card-particle" />
      )}

      {/* Badge de level no canto superior esquerdo */}
      <div
        className="absolute top-1.5 left-1.5 z-10 flex h-6 min-w-[24px] items-center justify-center px-1.5"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "var(--rarity-color)",
          background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)",
          border: "1px solid var(--rarity-color)",
          fontSize: 9,
          letterSpacing: "0.15em",
        }}
      >
        Lv {userCard.level}
      </div>

      {/* Badge de purity logo abaixo */}
      <div
        className="absolute top-9 left-1.5 z-10 flex h-5 items-center justify-center px-1.5"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: purityColor,
          background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)",
          border: `1px solid ${purityColor}`,
          fontSize: 8,
          letterSpacing: "0.18em",
          boxShadow: spectral ? `0 0 10px ${purityColor}` : undefined,
        }}
        aria-label={`Pureza ${userCard.purity}${spectral ? " - Cristal Espectral" : ""}`}
      >
        {purityLabel}
      </div>

      {/* Imagem do mob (mirror) */}
      <div className="relative h-[55%] w-full overflow-hidden">
        {card.mob.imageUrl ? (
          <Image
            src={card.mob.imageUrl}
            alt={card.mob.name}
            fill
            sizes="(max-width: 768px) 33vw, 200px"
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
              fontSize: 32,
            }}
          >
            {card.mob.name.charAt(0)}
          </div>
        )}

        {/* Gradient overlay embaixo da imagem */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg-primary) 95%, transparent))",
          }}
        />
      </div>

      {/* Conteudo textual */}
      <div className="relative flex h-[45%] flex-col gap-1 px-2 py-2">
        {/* Slot badge + raridade */}
        <div className="flex items-center justify-between">
          <span
            className="text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            S{slotIndex + 1}
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

        {/* Nome do mob (curto) */}
        <div
          className="truncate text-[14px] font-medium leading-tight text-white"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          {card.mob.name}
        </div>

        {/* Bonus listados (ja escalonados pelo level) */}
        <ul className="mt-auto flex flex-col gap-0.5">
          {bonuses.slice(0, 3).map((b, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-1 text-[9px] tracking-[0.05em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              }}
            >
              <span className="truncate">{b}</span>
              {showMultiplier && (
                <span
                  className="shrink-0 text-[8px]"
                  style={{
                    color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                  }}
                >
                  {multiplierLabel}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Barra de XP / level do cristal */}
        <div className="mt-1.5">
          <CardLevelBar
            xp={userCard.xp}
            level={userCard.level}
            rarity={card.rarity}
            size="sm"
          />
        </div>

        {/* Botao de skill espectral — apenas para Espectrais (purity 100) */}
        {spectral && onSpectralSkillClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpectralSkillClick(userCard.id);
            }}
            aria-label={
              userCard.spectralSkillId
                ? "Trocar skill espectral"
                : "Definir skill espectral"
            }
            className="mt-1.5 cursor-pointer px-2 py-1 text-[8px] uppercase tracking-[0.25em] transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--gold)",
              border: "1px solid var(--gold)",
              background: "color-mix(in srgb, var(--gold) 8%, transparent)",
              boxShadow:
                "0 0 6px color-mix(in srgb, var(--gold) 30%, transparent)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "color-mix(in srgb, var(--gold) 18%, transparent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "color-mix(in srgb, var(--gold) 8%, transparent)";
            }}
          >
            {userCard.spectralSkillId ? "Trocar skill" : "Definir skill"}
          </button>
        )}
      </div>

      {/* Hover overlay com delta de stats em verde */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: "color-mix(in srgb, var(--bg-primary) 88%, transparent)",
        }}
      >
        <span
          className="mb-1 text-[8px] uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Bonus ativo
        </span>
        {bonuses.length === 0 && (
          <span
            className="text-[10px] italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            }}
          >
            sem efeito
          </span>
        )}
        {bonuses.map((b, i) => (
          <span
            key={i}
            className="text-[11px] font-medium"
            style={{
              fontFamily: "var(--font-mono)",
              color: "#6bd47a",
            }}
          >
            {b}
          </span>
        ))}
      </div>

      {/* Botoes de acao (canto superior direito) */}
      <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
        <button
          type="button"
          onClick={() => onChange(slotIndex)}
          aria-label={`Trocar cristal do slot ${slotIndex + 1}`}
          className="flex h-6 w-6 cursor-pointer items-center justify-center text-[10px] transition-colors"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            background: "color-mix(in srgb, var(--bg-primary) 80%, transparent)",
            border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ember)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ember)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "color-mix(in srgb, var(--gold) 80%, transparent)";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "color-mix(in srgb, var(--gold) 30%, transparent)";
          }}
        >
          {/* Icone trocar */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onUnequip(slotIndex)}
          aria-label={`Desequipar cristal do slot ${slotIndex + 1}`}
          className="flex h-6 w-6 cursor-pointer items-center justify-center text-[12px] transition-colors"
          style={{
            fontFamily: "monospace",
            color: "color-mix(in srgb, #d96a52 70%, transparent)",
            background: "color-mix(in srgb, var(--bg-primary) 80%, transparent)",
            border: "1px solid color-mix(in srgb, #d96a52 30%, transparent)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#d96a52";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#d96a52";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "color-mix(in srgb, #d96a52 70%, transparent)";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "color-mix(in srgb, #d96a52 30%, transparent)";
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardSlots — secao com 3 slots horizontais
// ---------------------------------------------------------------------------

export default function CardSlots({
  userCards,
  onSlotClick,
  onUnequip,
  onSpectralSkillClick,
}: Props) {
  // Indexar cards por slotIndex
  const equippedBySlot: Record<number, UserCardSummary | undefined> = {
    0: undefined,
    1: undefined,
    2: undefined,
  };
  for (const uc of userCards) {
    if (uc.equipped && uc.slotIndex !== null && uc.slotIndex >= 0 && uc.slotIndex <= 2) {
      equippedBySlot[uc.slotIndex] = uc;
    }
  }

  const totalCards = userCards.length;
  const equippedCount = userCards.filter((u) => u.equipped).length;

  return (
    <section
      className="relative border p-4"
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
      }}
    >
      {/* Corner ticks (mesmo padrao do Panel) */}
      {[
        { top: -1, left: -1 },
        { top: -1, right: -1 },
        { bottom: -1, left: -1 },
        { bottom: -1, right: -1 },
      ].map((pos, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-2.5 w-2.5"
          style={{
            ...pos,
            borderTop:
              pos.top !== undefined
                ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                : "none",
            borderBottom:
              pos.bottom !== undefined
                ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                : "none",
            borderLeft:
              pos.left !== undefined
                ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                : "none",
            borderRight:
              pos.right !== undefined
                ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                : "none",
          }}
        />
      ))}

      {/* Header */}
      <header
        className="mb-3.5 flex items-baseline justify-between border-b pb-2.5"
        style={{ borderColor: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
      >
        <span
          className="text-[10px] font-medium uppercase tracking-[0.35em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Cristais Equipados
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.35em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          {equippedCount}/3 &middot; {totalCards} no inventario
        </span>
      </header>

      {/* Grid de 3 slots */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((slotIndex) => {
          const card = equippedBySlot[slotIndex];
          if (card) {
            return (
              <FilledSlot
                key={slotIndex}
                userCard={card}
                slotIndex={slotIndex}
                onChange={onSlotClick}
                onUnequip={onUnequip}
                onSpectralSkillClick={onSpectralSkillClick}
              />
            );
          }
          return (
            <EmptySlot key={slotIndex} slotIndex={slotIndex} onClick={onSlotClick} />
          );
        })}
      </div>

      {/* Hint quando nao tem cartas */}
      {totalCards === 0 && (
        <p
          className="mt-3 text-center text-[11px] italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 50%, transparent)",
          }}
        >
          Vença mobs em batalha para coletar Cristais de Memoria.
        </p>
      )}

      {/* Marcador Espectral: glow dourado animado + particula leve */}
      <style jsx>{`
        @keyframes spectralCardGlow {
          0%,
          100% {
            box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 35%, transparent),
              0 0 18px color-mix(in srgb, var(--gold) 25%, transparent);
          }
          50% {
            box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 60%, transparent),
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
    </section>
  );
}
