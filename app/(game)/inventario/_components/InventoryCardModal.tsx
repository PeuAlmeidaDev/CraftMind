"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CardEffect, CardRarity, UserCardSummary } from "@/types/cards";
import type { StatName } from "@/types/skill";
import { scaleEffectForDisplay } from "@/lib/cards/level";
import { isSpectral } from "@/lib/cards/purity";
import CardLevelBar from "../../_components/CardLevelBar";

type Props = {
  open: boolean;
  userCard: UserCardSummary | null;
  /** Disparado quando o usuario clica em "Trocar skill espectral" no modal.
   *  A page do inventario abre o SpectralSkillSelectModal por cima. */
  onChangeSpectralSkill?: (userCardId: string) => void;
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

const STAT_LABEL: Record<StatName, string> = {
  physicalAtk: "ATK Fisico",
  physicalDef: "DEF Fisica",
  magicAtk: "ATK Magico",
  magicDef: "DEF Magica",
  hp: "HP",
  speed: "Velocidade",
  accuracy: "Precisao",
};

function formatEffect(effect: CardEffect): string | null {
  if (effect.type === "STAT_FLAT") {
    const sign = effect.value >= 0 ? "+" : "";
    return `${sign}${effect.value} ${STAT_LABEL[effect.stat]}`;
  }
  if (effect.type === "STAT_PERCENT") {
    const sign = effect.percent >= 0 ? "+" : "";
    const rounded = Math.round(effect.percent * 10) / 10;
    return `${sign}${rounded}% ${STAT_LABEL[effect.stat]}`;
  }
  return null;
}

function purityBadgeColor(purity: number): string {
  if (purity === 100) return "#f4c45a";
  if (purity >= 95) return "#b06bff";
  if (purity >= 90) return "#6b9dff";
  if (purity >= 70) return "#6bd47a";
  if (purity >= 40) return "#9ba3ad";
  return "#7a7280";
}

function purityBadgeLabel(purity: number): string {
  if (purity === 100) return "100% ESPECTRAL";
  return `${purity}%`;
}

function formatDate(iso: string | undefined): string {
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
// InventoryCardModal
// ---------------------------------------------------------------------------

export default function InventoryCardModal({
  open,
  userCard,
  onChangeSpectralSkill,
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

  if (!open || !userCard) return null;

  const { card } = userCard;
  const rarityClass = RARITY_CLASS[card.rarity];
  const spectral = isSpectral(userCard.purity);
  const purityColor = purityBadgeColor(userCard.purity);

  // Effects ja escalonados pra display (mesma logica do CardSlots).
  const scaledEffects = card.effects
    .map((e) => ({
      raw: e,
      scaled: scaleEffectForDisplay(e, userCard.level, userCard.purity),
    }))
    .map(({ raw, scaled }) => ({
      original: formatEffect(raw),
      now: formatEffect(scaled),
    }))
    .filter((p): p is { original: string; now: string } =>
      p.original !== null && p.now !== null,
    );

  const equippedLabel =
    userCard.equipped && userCard.slotIndex !== null
      ? `Equipada no slot ${userCard.slotIndex + 1}`
      : "Nao equipada";

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
        aria-label={`Detalhes de ${card.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full max-w-[860px] flex-col outline-none ${rarityClass}`}
        style={{
          maxHeight: "calc(100vh - 104px)",
          background:
            "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: "1px solid var(--rarity-color)",
          boxShadow: spectral
            ? "0 30px 80px var(--bg-primary), 0 0 50px rgba(244, 196, 90, 0.45)"
            : "0 30px 80px var(--bg-primary), 0 0 30px var(--rarity-glow)",
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--rarity-color)",
                border: "1px solid var(--rarity-color)",
              }}
            >
              {RARITY_LABEL[card.rarity]}
            </span>
            <span
              className="px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
              }}
            >
              T{card.mob.tier}
            </span>
            {spectral && (
              <span
                className="px-2 py-1 text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "#f4c45a",
                  border: "1px solid #f4c45a",
                  boxShadow: "0 0 10px rgba(244, 196, 90, 0.5)",
                }}
              >
                Espectral
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

        {/* Conteudo */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Coluna esquerda — arte da carta + nome + flavor */}
          <aside
            className="flex flex-col items-center gap-3 border-b p-5 md:w-[320px] md:shrink-0 md:border-b-0 md:border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 60%, transparent) 0%, var(--bg-primary) 100%)",
            }}
          >
            <div
              className={`relative aspect-[3/4] w-full max-w-[260px] overflow-hidden ${spectral ? "spectral-card-glow" : ""}`}
              style={{
                border: "1px solid var(--rarity-color)",
                boxShadow: `0 12px 28px var(--bg-primary), 0 0 24px var(--rarity-glow)`,
              }}
            >
              <div className="card-foil" style={{ zIndex: 3 }} />
              {spectral && (
                <span aria-hidden="true" className="spectral-card-particle" />
              )}
              {card.mob.imageUrl ? (
                <Image
                  src={card.mob.imageUrl}
                  alt={card.mob.name}
                  fill
                  sizes="(max-width: 768px) 70vw, 260px"
                  className="object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 100,
                    color: "var(--rarity-color)",
                  }}
                >
                  {card.mob.name.charAt(0)}
                </div>
              )}
            </div>

            <h2
              className="text-center text-[26px] font-medium leading-tight text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {card.name}
            </h2>

            {card.flavorText && (
              <p
                className="text-center text-[12px] italic leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                }}
              >
                &laquo; {card.flavorText} &raquo;
              </p>
            )}

            <Link
              href="/bestiary"
              onClick={onClose}
              className="mt-1 px-3 py-1.5 text-[9px] uppercase tracking-[0.25em] transition-colors"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--gold)",
                background: "color-mix(in srgb, var(--gold) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
              }}
            >
              Ver no bestiario
            </Link>
          </aside>

          {/* Coluna direita — secoes em scroll */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* Stats */}
            <SectionPanel title="Cristal">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <StatRow
                  label="Pureza"
                  value={purityBadgeLabel(userCard.purity)}
                  valueColor={purityColor}
                />
                <StatRow
                  label="Level"
                  value={
                    userCard.level >= 5
                      ? `Lv ${userCard.level} (MAX)`
                      : `Lv ${userCard.level}`
                  }
                  valueColor="var(--rarity-color)"
                />
                <StatRow label="Raridade" value={RARITY_LABEL[card.rarity]} />
                <StatRow label="Mob" value={card.mob.name} />
                <StatRow label="Tier do mob" value={`T${card.mob.tier}`} />
                {card.dropChance !== undefined && (
                  <StatRow
                    label="Drop chance"
                    value={`${(Math.round(card.dropChance * 10) / 10).toFixed(1)}%`}
                  />
                )}
                <StatRow
                  label="Coletada em"
                  value={formatDate(userCard.createdAt)}
                />
              </div>

              {/* Barra de XP */}
              <div
                className="mt-3 border-t pt-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
                }}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className="text-[10px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                    }}
                  >
                    Progresso de level
                  </span>
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                    }}
                  >
                    {userCard.xp} XP
                  </span>
                </div>
                <CardLevelBar
                  xp={userCard.xp}
                  level={userCard.level}
                  rarity={card.rarity}
                  size="md"
                />
              </div>
            </SectionPanel>

            {/* Status equipada */}
            <SectionPanel title="Status">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-2 py-1 text-[10px] uppercase tracking-[0.25em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: userCard.equipped
                      ? "var(--ember)"
                      : "color-mix(in srgb, var(--gold) 60%, transparent)",
                    border: `1px solid ${userCard.equipped ? "var(--ember)" : "color-mix(in srgb, var(--gold) 22%, transparent)"}`,
                    background: userCard.equipped
                      ? "color-mix(in srgb, var(--ember) 10%, transparent)"
                      : "transparent",
                  }}
                >
                  {equippedLabel}
                </span>
                {!userCard.equipped && (
                  <Link
                    href="/character"
                    onClick={onClose}
                    className="px-2 py-1 text-[10px] uppercase tracking-[0.25em] transition-colors"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "var(--gold)",
                      border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
                      background:
                        "color-mix(in srgb, var(--gold) 6%, transparent)",
                    }}
                  >
                    Ir para personagem
                  </Link>
                )}
              </div>
            </SectionPanel>

            {/* Effects */}
            <SectionPanel title="Efeitos do cristal">
              {scaledEffects.length === 0 ? (
                <p
                  className="text-[12px] italic"
                  style={{
                    fontFamily: "var(--font-garamond)",
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }}
                >
                  Sem efeitos numericos definidos.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {scaledEffects.map((eff, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 px-2 py-1.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--bg-primary) 50%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--gold) 12%, transparent)",
                      }}
                    >
                      <span
                        className="text-[12px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "#6bd47a",
                        }}
                      >
                        {eff.now}
                      </span>
                      {eff.now !== eff.original && (
                        <span
                          className="text-[10px]"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color:
                              "color-mix(in srgb, var(--gold) 50%, transparent)",
                          }}
                          title="Valor base do cristal antes de level e pureza"
                        >
                          base: {eff.original}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionPanel>

            {/* Skill espectral */}
            {spectral && (
              <SectionPanel title="Skill Espectral">
                {userCard.spectralSkillId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-2 py-1 text-[10px] uppercase tracking-[0.25em]"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "#f4c45a",
                        border: "1px solid #f4c45a",
                        background: "rgba(244, 196, 90, 0.08)",
                      }}
                    >
                      Skill definida
                    </span>
                    {onChangeSpectralSkill && (
                      <button
                        type="button"
                        onClick={() => onChangeSpectralSkill(userCard.id)}
                        className="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-[0.25em] transition-colors"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--gold)",
                          border: "1px solid var(--gold)",
                          background:
                            "color-mix(in srgb, var(--gold) 8%, transparent)",
                        }}
                      >
                        Trocar skill
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[12px] italic"
                      style={{
                        fontFamily: "var(--font-garamond)",
                        color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                      }}
                    >
                      Nenhuma skill espectral definida ainda.
                    </span>
                    {onChangeSpectralSkill && (
                      <button
                        type="button"
                        onClick={() => onChangeSpectralSkill(userCard.id)}
                        className="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-[0.25em] transition-colors"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--gold)",
                          border: "1px solid var(--gold)",
                          background:
                            "color-mix(in srgb, var(--gold) 8%, transparent)",
                        }}
                      >
                        Definir skill
                      </button>
                    )}
                  </div>
                )}
              </SectionPanel>
            )}
          </div>
        </div>

        {/* Estilos da animacao espectral */}
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers visuais
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
        background:
          "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
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
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
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
        className="truncate text-[12px] font-medium"
        style={{
          fontFamily: "var(--font-mono)",
          color: valueColor ?? "white",
        }}
      >
        {value}
      </span>
    </div>
  );
}
