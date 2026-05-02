"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { BestiaryEntry, BestiaryCardInfo, CardRarity } from "@/types/cards";
import {
  BestiaryUnlockTier,
  BESTIARY_THRESHOLDS,
} from "@/types/cards";

type Props = {
  entry: BestiaryEntry | null;
  /** Variante de cristal focada. Null quando o usuario abre o modal pela
   * imagem do mob (sem clicar em um slot especifico). */
  selectedCard: BestiaryCardInfo | null;
  open: boolean;
  onClose: () => void;
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

const DAMAGE_TYPE_INFO: Record<string, { label: string; color: string }> = {
  PHYSICAL: { label: "Fisico", color: "#ff8a70" },
  MAGICAL: { label: "Magico", color: "#8fa8ff" },
  NONE: { label: "Suporte", color: "#b9ff8a" },
};

function nextThreshold(victories: number): number | null {
  if (victories < BESTIARY_THRESHOLDS.STUDIED) return BESTIARY_THRESHOLDS.STUDIED;
  if (victories < BESTIARY_THRESHOLDS.MASTERED) return BESTIARY_THRESHOLDS.MASTERED;
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// LockedSection — bloco com cadeado e contador de unlock
// ---------------------------------------------------------------------------

function LockedSection({
  label,
  victories,
  threshold,
}: {
  label: string;
  victories: number;
  threshold: number;
}) {
  const remaining = Math.max(0, threshold - victories);
  return (
    <div
      className="flex flex-col items-center gap-2 px-4 py-6 text-center"
      style={{
        background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
        border: "1px dashed color-mix(in srgb, var(--gold) 22%, transparent)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div
        className="text-[10px] uppercase tracking-[0.3em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 75%, transparent)",
        }}
      >
        {label}
      </div>
      <div
        className="text-[11px] italic"
        style={{
          fontFamily: "var(--font-garamond)",
          color: "color-mix(in srgb, var(--gold) 55%, transparent)",
        }}
      >
        Derrote mais{" "}
        <span style={{ color: "var(--ember)" }}>{remaining}</span>{" "}
        vez{remaining === 1 ? "" : "es"} para desbloquear
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BestiaryDetailModal
// ---------------------------------------------------------------------------

export default function BestiaryDetailModal({
  entry,
  selectedCard,
  open,
  onClose,
}: Props) {
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

  const [holoActive, setHoloActive] = useState(false);
  const [holoCoords, setHoloCoords] = useState<{ mx: string; my: string }>({
    mx: "50%",
    my: "50%",
  });

  const handleHoloMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    setHoloCoords({ mx: `${mx}%`, my: `${my}%` });
    setHoloActive(true);
  }, []);

  const handleHoloLeave = useCallback(() => {
    setHoloActive(false);
    setHoloCoords({ mx: "50%", my: "50%" });
  }, []);

  if (!open || !entry) return null;

  const isUndiscovered = entry.unlockTier === BestiaryUnlockTier.UNDISCOVERED;
  const isDiscovered =
    entry.unlockTier === BestiaryUnlockTier.DISCOVERED ||
    entry.unlockTier === BestiaryUnlockTier.STUDIED ||
    entry.unlockTier === BestiaryUnlockTier.MASTERED;
  const isStudied =
    entry.unlockTier === BestiaryUnlockTier.STUDIED ||
    entry.unlockTier === BestiaryUnlockTier.MASTERED;
  const isMastered = entry.unlockTier === BestiaryUnlockTier.MASTERED;

  // Se uma variante foi clicada, usamos a raridade dela. Caso contrario,
  // pega a maior raridade entre as variantes coletadas (highlight do mob).
  const ownedCards = entry.cards.filter((c) => c.hasCard);
  const focusedRarity: CardRarity | null = selectedCard
    ? selectedCard.rarity
    : ownedCards.length > 0
      ? ownedCards[ownedCards.length - 1].rarity
      : null;
  const cardRarity = focusedRarity;
  const rarityClass = cardRarity ? RARITY_CLASS[cardRarity] : "";
  const tierColor =
    entry.tier !== null ? TIER_COLORS[entry.tier] ?? TIER_COLORS[1] : "#3a3a4a";
  const accentColor = cardRarity ? "var(--rarity-color)" : tierColor;

  // Foto exibida na coluna esquerda do modal:
  // - se o user clicou em uma variante (selectedCard !== null), usa a arte dela
  //   (em silhueta+grayscale quando nao coletada).
  // - senao, usa a arte da melhor variante coletada ou a imageUrl do mob.
  const focusedArt = selectedCard
    ? selectedCard.cardArtUrl ?? entry.imageUrl
    : ownedCards[ownedCards.length - 1]?.cardArtUrl ?? entry.imageUrl;
  const focusedOwned = selectedCard ? selectedCard.hasCard : true;

  const isHolo3 = selectedCard?.requiredStars === 3 && focusedOwned;

  const next = nextThreshold(entry.victories);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 grid place-items-center px-4 pt-[80px] pb-6 sm:px-6"
      style={{
        background: "rgba(5, 3, 10, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={entry.name ?? "Criatura desconhecida"}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full max-w-[900px] flex-col outline-none ${rarityClass}`}
        style={{
          maxHeight: "calc(100vh - 104px)",
          background:
            "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: `1px solid ${cardRarity ? "var(--rarity-color)" : tierColor}`,
          boxShadow: isMastered
            ? "0 30px 80px var(--bg-primary), 0 0 60px rgba(244, 196, 90, 0.4)"
            : `0 30px 80px var(--bg-primary), 0 0 30px color-mix(in srgb, ${cardRarity ? "var(--rarity-color)" : tierColor} 30%, transparent)`,
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            {entry.tier !== null && (
              <span
                className="px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: tierColor,
                  border: `1px solid ${tierColor}66`,
                }}
              >
                T{entry.tier}
              </span>
            )}
            {isMastered && (
              <span
                className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "#f4c45a",
                  border: "1px solid rgba(244, 196, 90, 0.7)",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18.5 21 L12 16.5 L5.5 21 L8 13.5 L2 9 L9.5 9 Z" />
                </svg>
                Mestre
              </span>
            )}
            {selectedCard && (
              <span
                className="px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "var(--rarity-color)",
                  border: "1px solid var(--rarity-color)",
                }}
              >
                Cristal {RARITY_LABEL[selectedCard.rarity]}
                {" · "}
                {"★".repeat(selectedCard.requiredStars)}
              </span>
            )}
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

        {/* Conteudo: foto a esquerda, info a direita (md+); empilhado no mobile */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* COLUNA ESQUERDA — Foto + nome + descricao curta */}
          <aside
            className="flex flex-col items-center gap-3 border-b p-5 md:w-[340px] md:shrink-0 md:border-b-0 md:border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 60%, transparent) 0%, var(--bg-primary) 100%)",
            }}
          >
            <div
              className="relative aspect-[3/4] w-full max-w-[280px] overflow-hidden"
              onMouseMove={isHolo3 ? handleHoloMove : undefined}
              onMouseLeave={isHolo3 ? handleHoloLeave : undefined}
              style={{
                border: `1px solid color-mix(in srgb, ${cardRarity ? "var(--rarity-color)" : tierColor} 55%, transparent)`,
                boxShadow: `0 12px 28px var(--bg-primary), 0 0 24px color-mix(in srgb, ${accentColor} 22%, transparent)`,
              }}
            >
              {/* Foil holografico se descoberto+ */}
              {isDiscovered && <div className="card-foil" style={{ zIndex: 3 }} />}
              {isHolo3 && (
                <div
                  className={`card-holo-3 ${holoActive ? "is-active" : ""}`}
                  style={
                    {
                      zIndex: 4,
                      "--mx": holoCoords.mx,
                      "--my": holoCoords.my,
                    } as React.CSSProperties
                  }
                />
              )}

              {isUndiscovered ? (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-secondary) 60%, transparent) 0%, var(--bg-primary) 80%)",
                  }}
                >
                  <span
                    className="text-[120px] font-medium leading-none"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      color: "color-mix(in srgb, var(--gold) 22%, transparent)",
                      textShadow:
                        "0 0 16px color-mix(in srgb, var(--accent-primary) 25%, transparent)",
                    }}
                  >
                    ?
                  </span>
                </div>
              ) : !focusedOwned ? (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, color-mix(in srgb, var(--bg-secondary) 60%, transparent) 0%, var(--bg-primary) 80%)",
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 100,
                    color: "color-mix(in srgb, var(--gold) 35%, transparent)",
                    filter: "grayscale(1)",
                  }}
                >
                  ?
                </div>
              ) : focusedArt ? (
                <Image
                  src={focusedArt}
                  alt={entry.name ?? "Criatura"}
                  fill
                  sizes="(max-width: 768px) 70vw, 280px"
                  className="object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 100,
                    color: accentColor,
                  }}
                >
                  {(entry.name ?? "?").charAt(0)}
                </div>
              )}
            </div>

            {/* Nome */}
            <h2
              className="text-center text-[28px] font-medium leading-tight text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {isUndiscovered ? "Criatura desconhecida" : entry.name}
            </h2>

            {/* Descricao curta */}
            {isDiscovered && entry.descriptionShort && (
              <p
                className="text-center text-[12.5px] italic leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                }}
              >
                &laquo; {entry.descriptionShort} &raquo;
              </p>
            )}
            {isUndiscovered && (
              <p
                className="text-center text-[12px] italic"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                }}
              >
                Voce ainda nao enfrentou esta criatura. Vença-a uma vez para revelar seu nome e
                descricao.
              </p>
            )}
          </aside>

          {/* COLUNA DIREITA — Secoes em scroll */}
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Variante focada — exibida quando o user clicou em um slot */}
          {selectedCard && (
            <SectionPanel
              title={`Cristal ${"★".repeat(selectedCard.requiredStars)} — ${RARITY_LABEL[selectedCard.rarity]}`}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <StatRow
                  label="Estrelas"
                  value={"★".repeat(selectedCard.requiredStars)}
                />
                <StatRow
                  label="Raridade"
                  value={RARITY_LABEL[selectedCard.rarity]}
                />
              </div>
              {selectedCard.hasCard && selectedCard.userCardLevel !== null && selectedCard.userCardXp !== null && (
                <div className="mt-3 border-t pt-3" style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[10px] uppercase tracking-[0.3em]"
                      style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 70%, transparent)" }}
                    >
                      Nivel do cristal
                    </span>
                    <span
                      className="text-[12px] font-medium"
                      style={{ fontFamily: "var(--font-cinzel)", color: "var(--rarity-color)", letterSpacing: "0.15em" }}
                    >
                      Lv {selectedCard.userCardLevel}
                      {selectedCard.userCardLevel >= 5 && " (MAX)"}
                    </span>
                  </div>
                  <XpBar xp={selectedCard.userCardXp} level={selectedCard.userCardLevel} />
                </div>
              )}
              {selectedCard.hasCard && selectedCard.flavorText ? (
                <p
                  className="mt-3 border-t pt-3 text-[13px] italic leading-relaxed"
                  style={{
                    borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
                    fontFamily: "var(--font-garamond)",
                    color: "color-mix(in srgb, var(--ink) 85%, transparent)",
                    textWrap: "pretty",
                  }}
                >
                  &laquo; {selectedCard.flavorText} &raquo;
                </p>
              ) : (
                <p
                  className="mt-3 border-t pt-3 text-[12px] italic leading-relaxed"
                  style={{
                    borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
                    fontFamily: "var(--font-garamond)",
                    color: "color-mix(in srgb, var(--gold) 65%, transparent)",
                  }}
                >
                  Lore desconhecido — derrote a versao{" "}
                  {selectedCard.requiredStars}
                  {selectedCard.requiredStars === 1 ? "⭐" : selectedCard.requiredStars === 2 ? "⭐⭐" : "⭐⭐⭐"}
                  {" "}deste mob para descobrir.
                </p>
              )}
            </SectionPanel>
          )}

          {/* Cacada — sempre que descoberto */}
          {isDiscovered && entry.personalStats && (
            <SectionPanel title="Caçada">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatRow
                  label="Vitorias"
                  value={String(entry.personalStats.victories)}
                  stacked
                />
                <StatRow
                  label="Derrotas"
                  value={String(entry.personalStats.defeats)}
                  stacked
                />
                <StatRow
                  label="Win rate"
                  value={(() => {
                    const total =
                      entry.personalStats.victories + entry.personalStats.defeats;
                    if (total === 0) return "—";
                    const pct = Math.round(
                      (entry.personalStats.victories / total) * 100,
                    );
                    return `${pct}%`;
                  })()}
                  stacked
                />
                <StatRow
                  label="Dano total"
                  value={String(entry.personalStats.damageDealt)}
                  stacked
                />
                <StatRow
                  label="Primeiro encontro"
                  value={formatDate(entry.personalStats.firstSeenAt)}
                  stacked
                />
                <StatRow
                  label="Ultimo combate"
                  value={formatDate(entry.personalStats.lastSeenAt)}
                  stacked
                />
              </div>
              {entry.cards.length > 0 && (
                <div
                  className="mt-3 flex items-center justify-between border-t pt-2.5"
                  style={{
                    borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                >
                  <span
                    className="text-[10px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                    }}
                  >
                    Cristais coletados
                  </span>
                  <span
                    className="text-[12px] font-medium uppercase tracking-[0.25em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color:
                        ownedCards.length > 0 ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 60%, transparent)",
                    }}
                  >
                    {ownedCards.length}/{entry.cards.length}
                  </span>
                </div>
              )}
            </SectionPanel>
          )}

          {/* Stats — STUDIED+ */}
          <SectionPanel title="Atributos">
            {isStudied && entry.stats ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <StatRow label="HP" value={String(entry.stats.hp)} />
                <StatRow
                  label="ATK Fisico"
                  value={String(entry.stats.physicalAtk)}
                />
                <StatRow
                  label="DEF Fisica"
                  value={String(entry.stats.physicalDef)}
                />
                <StatRow
                  label="ATK Magico"
                  value={String(entry.stats.magicAtk)}
                />
                <StatRow
                  label="DEF Magica"
                  value={String(entry.stats.magicDef)}
                />
                <StatRow label="Velocidade" value={String(entry.stats.speed)} />
                {entry.aiProfile && (
                  <StatRow label="IA" value={entry.aiProfile} />
                )}
              </div>
            ) : (
              <LockedSection
                label="Atributos ocultos"
                victories={entry.victories}
                threshold={BESTIARY_THRESHOLDS.STUDIED}
              />
            )}
          </SectionPanel>

          {/* Skills — STUDIED+ */}
          <SectionPanel title="Habilidades">
            {isStudied && entry.skills && entry.skills.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {entry.skills.map((s, i) => {
                  const dt = DAMAGE_TYPE_INFO[s.damageType] ?? {
                    label: s.damageType,
                    color: "#999",
                  };
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between p-2"
                      style={{
                        background: "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-px text-[8px] uppercase tracking-[0.2em]"
                          style={{
                            fontFamily: "var(--font-cinzel)",
                            color: TIER_COLORS[s.tier] ?? TIER_COLORS[1],
                            border: `1px solid ${TIER_COLORS[s.tier] ?? TIER_COLORS[1]}66`,
                          }}
                        >
                          T{s.tier}
                        </span>
                        <span
                          className="text-[14px] font-medium text-white"
                          style={{ fontFamily: "var(--font-cormorant)" }}
                        >
                          {s.name}
                        </span>
                      </div>
                      <span
                        className="text-[9px] uppercase tracking-[0.2em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: dt.color,
                        }}
                      >
                        {dt.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <LockedSection
                label="Habilidades ocultas"
                victories={entry.victories}
                threshold={BESTIARY_THRESHOLDS.STUDIED}
              />
            )}
          </SectionPanel>

          {/* Lore expandido — MASTERED */}
          <SectionPanel title="Lore">
            {isMastered && entry.loreExpanded ? (
              <p
                className="text-[13px] leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--ink) 85%, transparent)",
                  textWrap: "pretty",
                }}
              >
                {entry.loreExpanded}
              </p>
            ) : isDiscovered && entry.descriptionShort ? (
              <p
                className="text-[13px] italic leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                }}
              >
                &laquo; {entry.descriptionShort} &raquo;
                <br />
                <span
                  className="mt-2 inline-block text-[10px] not-italic uppercase tracking-[0.25em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                  }}
                >
                  Lore expandido em Mestre&nbsp;
                  {next !== null
                    ? `(faltam ${Math.max(0, BESTIARY_THRESHOLDS.MASTERED - entry.victories)} vitorias)`
                    : ""}
                </span>
              </p>
            ) : (
              <LockedSection
                label="Lore oculto"
                victories={entry.victories}
                threshold={BESTIARY_THRESHOLDS.DISCOVERED}
              />
            )}
          </SectionPanel>

          {/* Curiosidade — MASTERED */}
          <SectionPanel title="Curiosidade">
            {isMastered && entry.curiosity ? (
              <p
                className="text-[13px] italic leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "#f4c45a",
                  textWrap: "pretty",
                }}
              >
                &laquo; {entry.curiosity} &raquo;
              </p>
            ) : (
              <LockedSection
                label="Curiosidade oculta"
                victories={entry.victories}
                threshold={BESTIARY_THRESHOLDS.MASTERED}
              />
            )}
          </SectionPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionPanel — bloco titulado reutilizavel dentro do modal
// ---------------------------------------------------------------------------

function SectionPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative border p-3.5"
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
      }}
    >
      <header
        className="mb-3 flex items-baseline justify-between border-b pb-2"
        style={{ borderColor: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
      >
        <span
          className="text-[10px] font-medium uppercase tracking-[0.35em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          {title}
        </span>
      </header>
      {children}
    </section>
  );
}

function StatRow({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: string;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div
        className="flex flex-col gap-1 px-2 py-1.5"
        style={{
          background: "color-mix(in srgb, var(--bg-primary) 50%, transparent)",
          border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
        }}
      >
        <span
          className="text-[9px] uppercase leading-none tracking-[0.25em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          }}
        >
          {label}
        </span>
        <span
          className="truncate text-[13px] font-medium text-white"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className="text-[10px] uppercase tracking-[0.25em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 65%, transparent)",
        }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-medium text-white"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

const CARD_LEVEL_THRESHOLDS = [0, 0, 100, 250, 500, 1000] as const;

function XpBar({ xp, level }: { xp: number; level: number }) {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level)));
  if (safeLevel >= 5) {
    return (
      <div
        className="text-[10px] italic text-center"
        style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
      >
        XP cumulativo: {xp}
      </div>
    );
  }
  const currentLevelMin = CARD_LEVEL_THRESHOLDS[safeLevel];
  const nextLevelMax = CARD_LEVEL_THRESHOLDS[safeLevel + 1];
  const progress = Math.max(0, Math.min(1, (xp - currentLevelMin) / (nextLevelMax - currentLevelMin)));
  const xpInLevel = xp - currentLevelMin;
  const xpNeeded = nextLevelMax - currentLevelMin;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-2 w-full overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
          border: "1px solid color-mix(in srgb, var(--gold) 18%, transparent)",
        }}
      >
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(to right, var(--rarity-color), var(--ember))",
          }}
        />
      </div>
      <div
        className="flex justify-between text-[9px]"
        style={{ fontFamily: "var(--font-mono)", color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
      >
        <span>{xpInLevel} / {xpNeeded} XP</span>
        <span>Lv {safeLevel + 1} em {xpNeeded - xpInLevel} XP</span>
      </div>
    </div>
  );
}
