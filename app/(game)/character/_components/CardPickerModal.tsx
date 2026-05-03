"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { CardEffect, CardRarity } from "@/types/cards";
import type { StatName } from "@/types/skill";
import type { UserCardSummary } from "./CardSlots";
import { scaleEffectForDisplay } from "@/lib/cards/level";
import { isSpectral } from "@/lib/cards/purity";
import CardLevelBar from "../../_components/CardLevelBar";

type Props = {
  open: boolean;
  slotIndex: number;
  /** Todas as UserCards do usuario (filtramos as nao equipadas dentro do modal). */
  userCards: UserCardSummary[];
  onSelect: (userCardId: string, slotIndex: number) => void;
  onClose: () => void;
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

const RARITY_ORDER: CardRarity[] = ["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"];

const STAT_LABEL: Record<StatName, string> = {
  physicalAtk: "ATK Fis",
  physicalDef: "DEF Fis",
  magicAtk: "ATK Mag",
  magicDef: "DEF Mag",
  hp: "HP",
  speed: "VEL",
  accuracy: "PRC",
};

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

export default function CardPickerModal({
  open,
  slotIndex,
  userCards,
  onSelect,
  onClose,
}: Props) {
  const [activeRarities, setActiveRarities] = useState<Set<CardRarity>>(
    () => new Set(RARITY_ORDER),
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    const timer = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(timer);
    };
  }, [open, handleKeyDown]);

  // Apenas cartas nao equipadas (ou equipadas em outro slot — permitimos mover).
  // O endpoint POST /api/cards/equip cuida do swap.
  const candidates = useMemo(
    () => userCards.filter((u) => !u.equipped || u.slotIndex !== slotIndex),
    [userCards, slotIndex],
  );

  const filtered = useMemo(() => {
    const list = candidates.filter((u) => activeRarities.has(u.card.rarity));
    // Agrupa copias do mesmo cardId, melhor primeiro (purity desc, depois level desc).
    return list.sort((a, b) => {
      if (a.card.id !== b.card.id) {
        return a.card.id.localeCompare(b.card.id);
      }
      if (b.purity !== a.purity) return b.purity - a.purity;
      return b.level - a.level;
    });
  }, [candidates, activeRarities]);

  const totalCards = userCards.length;

  function toggleRarity(r: CardRarity) {
    setActiveRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{
        background: "rgba(5, 3, 10, 0.82)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Escolher cristal para slot ${slotIndex + 1}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[720px] flex-col outline-none"
        style={{
          maxHeight: "calc(100vh - 48px)",
          background:
            "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--ember) 40%, transparent)",
          boxShadow:
            "0 30px 80px var(--bg-primary), 0 0 40px color-mix(in srgb, var(--ember) 14%, transparent)",
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.35em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              }}
            >
              Slot {slotIndex + 1}
            </div>
            <h2
              className="mt-1 text-[26px] font-medium text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Escolher cristal
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 cursor-pointer items-center justify-center text-lg transition-colors"
            style={{
              fontFamily: "monospace",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
            }}
          >
            &times;
          </button>
        </header>

        {/* Filtros de raridade */}
        {totalCards > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5"
            style={{ borderColor: "color-mix(in srgb, var(--gold) 8%, transparent)" }}
          >
            <span
              className="text-[9px] uppercase tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              }}
            >
              Raridade
            </span>
            <div className="flex flex-wrap gap-1">
              {RARITY_ORDER.map((r) => {
                const active = activeRarities.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRarity(r)}
                    className={`cursor-pointer px-2 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors ${RARITY_CLASS[r]}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: active ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 50%, transparent)",
                      background: active
                        ? "color-mix(in srgb, var(--rarity-color) 12%, transparent)"
                        : "transparent",
                      border: `1px solid ${active ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                    }}
                  >
                    {RARITY_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-3.5">
          {totalCards === 0 ? (
            <div
              className="py-9 text-center italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 47%, transparent)",
              }}
            >
              Nenhum cristal coletado ainda. Vença mobs em batalha para encontrar fragmentos lunares.
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="py-9 text-center italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 47%, transparent)",
              }}
            >
              Nenhum cristal corresponde aos filtros.
            </div>
          ) : (
            filtered.map((entry) => {
              const { card } = entry;
              const rarityClass = RARITY_CLASS[card.rarity];
              const bonuses = card.effects
                .map((e) => formatEffect(scaleEffectForDisplay(e, entry.level, entry.purity)))
                .filter((s): s is string => s !== null);
              const equippedElsewhere = entry.equipped && entry.slotIndex !== null;
              const spectral = isSpectral(entry.purity);
              const purityLabel = purityBadgeLabel(entry.purity);
              const purityColor = purityBadgeColor(entry.purity);

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry.id, slotIndex)}
                  className={`grid w-full cursor-pointer items-center gap-3 p-3 text-left transition-all ${rarityClass}`}
                  style={{
                    gridTemplateColumns: "60px 1fr auto",
                    background: "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
                    border: `1px solid color-mix(in srgb, var(--rarity-color) 35%, transparent)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--rarity-color)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 0 12px var(--rarity-glow)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `color-mix(in srgb, var(--rarity-color) 35%, transparent)`;
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                  }}
                >
                  {/* Mini retrato do mob */}
                  <div
                    className="relative h-[60px] w-[60px] overflow-hidden"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--rarity-color) 50%, transparent)",
                      background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
                    }}
                  >
                    {card.mob.imageUrl ? (
                      <Image
                        src={card.mob.imageUrl}
                        alt={card.mob.name}
                        fill
                        sizes="60px"
                        className="object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          fontFamily: "var(--font-cormorant)",
                          color: "var(--rarity-color)",
                          fontSize: 24,
                        }}
                      >
                        {card.mob.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Conteudo */}
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--rarity-color)",
                          border: "1px solid color-mix(in srgb, var(--rarity-color) 60%, transparent)",
                        }}
                      >
                        {RARITY_LABEL[card.rarity]}
                      </span>
                      <span
                        className="text-[9px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                        }}
                      >
                        T{card.mob.tier}
                      </span>
                      <span
                        className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--rarity-color)",
                          border: "1px solid color-mix(in srgb, var(--rarity-color) 60%, transparent)",
                        }}
                      >
                        Lv {entry.level}
                      </span>
                      <span
                        className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: purityColor,
                          border: `1px solid ${purityColor}`,
                          boxShadow: spectral ? `0 0 8px ${purityColor}` : undefined,
                        }}
                        aria-label={`Pureza ${entry.purity}${spectral ? " - Cristal Espectral" : ""}`}
                      >
                        {purityLabel}
                      </span>
                      {equippedElsewhere && entry.slotIndex !== null && (
                        <span
                          className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                          style={{
                            fontFamily: "var(--font-cinzel)",
                            color: "var(--gold)",
                            border:
                              "1px solid color-mix(in srgb, var(--gold) 53%, transparent)",
                          }}
                        >
                          EQUIP. S{entry.slotIndex + 1}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[16px] font-medium text-white"
                      style={{ fontFamily: "var(--font-cormorant)" }}
                    >
                      {card.name}
                    </div>
                    <div
                      className="mt-0.5 text-xs italic"
                      style={{
                        fontFamily: "var(--font-garamond)",
                        color: "color-mix(in srgb, var(--gold) 67%, transparent)",
                      }}
                    >
                      {card.flavorText}
                    </div>
                    <div className="mt-2">
                      <CardLevelBar
                        xp={entry.xp}
                        level={entry.level}
                        rarity={card.rarity}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Bonus */}
                  <div
                    className="text-right text-[9px] tracking-[0.05em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "color-mix(in srgb, var(--gold) 75%, transparent)",
                    }}
                  >
                    {bonuses.length === 0 ? (
                      <span style={{ color: "color-mix(in srgb, var(--gold) 40%, transparent)" }}>
                        sem efeito
                      </span>
                    ) : (
                      bonuses.slice(0, 3).map((b, i) => <div key={i}>{b}</div>)
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
