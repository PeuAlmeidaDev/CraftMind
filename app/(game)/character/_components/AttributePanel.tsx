"use client";

import { useState, useEffect, useRef } from "react";
import { getToken, authFetchOptions } from "@/lib/client-auth";
import type { Character } from "@/types/character";
import Panel from "@/components/ui/Panel";
import AttributeRadar from "@/components/ui/AttributeRadar";

type Props = {
  character: Character;
  onDistribute: (updatedCharacter: Character) => void;
};

const STATS = [
  { key: "physicalAtk" as const, label: "Ataque Fisico", abbr: "ATK.F", icon: "⚔️" },
  { key: "physicalDef" as const, label: "Defesa Fisica", abbr: "DEF.F", icon: "🛡️" },
  { key: "magicAtk" as const, label: "Ataque Magico", abbr: "ATK.M", icon: "✨" },
  { key: "magicDef" as const, label: "Defesa Magica", abbr: "DEF.M", icon: "🔮" },
  { key: "hp" as const, label: "Vida", abbr: "HP", icon: "❤️", multiplier: 10 },
  { key: "speed" as const, label: "Velocidade", abbr: "SPD", icon: "💨" },
] as const;

type StatKey = (typeof STATS)[number]["key"];

const INITIAL_ALLOCATION: Record<StatKey, number> = {
  physicalAtk: 0,
  physicalDef: 0,
  magicAtk: 0,
  magicDef: 0,
  hp: 0,
  speed: 0,
};

// Textos explicativos por atributo (jogador novo). Sem acentos por convencao do projeto.
const STAT_TOOLTIPS: Record<StatKey, string> = {
  physicalAtk:
    "Aumenta o dano dos seus ataques fisicos (espada, garra, soco). Quanto maior, mais forte voce bate. Funciona melhor contra alvos com pouca Defesa Fisica.",
  physicalDef:
    "Reduz o dano que voce recebe de ataques fisicos. Stat principal pra tanks que querem segurar lance corpo a corpo.",
  magicAtk:
    "Aumenta o dano dos seus ataques magicos (feiticos, runas, energia arcana). Funciona melhor contra alvos com pouca Defesa Magica.",
  magicDef:
    "Reduz o dano que voce recebe de ataques magicos. Importante contra mobs que usam bolas de fogo, gelo e maldicoes.",
  hp: "Sua vida total. Quando chega a zero, voce e derrotado. Cada ponto investido em Vida vale 10 HP.",
  speed:
    "Define quem ataca primeiro no turno (ordem: prioridade > speed > sorte). NAO afeta esquiva — chance de errar e calculada via accuracy da skill + stages.",
};

// Botao "?" + tooltip controlado pelo pai (open/close).
function StatTooltip({
  statKey,
  label,
  isOpen,
  onToggle,
}: {
  statKey: StatKey;
  label: string;
  isOpen: boolean;
  onToggle: (key: StatKey | null) => void;
}) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={`Saiba mais sobre ${label}`}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(isOpen ? null : statKey);
        }}
        onMouseEnter={() => onToggle(statKey)}
        onMouseLeave={() => onToggle(null)}
        className="cursor-pointer border-none bg-transparent p-0 leading-none transition-opacity hover:opacity-100"
        style={{
          fontFamily: "var(--font-cinzel)",
          fontSize: 11,
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          width: 14,
          height: 14,
          lineHeight: "14px",
        }}
      >
        ?
      </button>

      {isOpen && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => onToggle(statKey)}
          onMouseLeave={() => onToggle(null)}
          className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2"
          style={{
            zIndex: 50,
            width: 240,
            background: "var(--bg-card)",
            border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
            padding: "10px 12px",
            fontFamily: "var(--font-garamond)",
            fontSize: 12,
            lineHeight: 1.5,
            color: "color-mix(in srgb, var(--gold) 90%, white)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {STAT_TOOLTIPS[statKey]}
        </span>
      )}
    </span>
  );
}

export default function AttributePanel({ character, onDistribute }: Props) {
  const [allocation, setAllocation] = useState<Record<StatKey, number>>({ ...INITIAL_ALLOCATION });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const totalAllocated = Object.values(allocation).reduce((sum, v) => sum + v, 0);
  const remaining = character.freePoints - totalAllocated;
  const isDistributeMode = character.freePoints > 0;

  // Fecha tooltip ao apertar Esc ou clicar fora
  useEffect(() => {
    if (openStat === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenStat(null);
    }

    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenStat(null);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openStat]);

  function handleIncrement(key: StatKey) {
    if (remaining <= 0) return;
    setAllocation((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  }

  function handleDecrement(key: StatKey) {
    if (allocation[key] <= 0) return;
    setAllocation((prev) => ({ ...prev, [key]: prev[key] - 1 }));
  }

  function handleReset() {
    setAllocation({ ...INITIAL_ALLOCATION });
  }

  async function handleConfirm() {
    if (totalAllocated === 0 || isSubmitting) return;

    const distribution: Partial<Record<StatKey, number>> = {};
    for (const [key, value] of Object.entries(allocation)) {
      if (value > 0) {
        distribution[key as StatKey] = value;
      }
    }

    setIsSubmitting(true);
    try {
      const token = getToken();
      const opts = authFetchOptions(token ?? "");
      const res = await fetch("/api/character/distribute-points", {
        ...opts,
        method: "POST",
        headers: {
          ...(opts.headers as Record<string, string>),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ distribution }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const message = errorBody?.error ?? "Erro ao distribuir pontos";
        throw new Error(message);
      }

      const { data } = (await res.json()) as { data: Character };
      setAllocation({ ...INITIAL_ALLOCATION });
      onDistribute(data);
    } catch (err) {
      console.error("Falha ao distribuir pontos:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function getPreviewValue(key: StatKey, multiplier?: number): number {
    const base = character[key];
    const added = allocation[key];
    return base + added * (multiplier ?? 1);
  }

  // Modo visualizacao
  if (!isDistributeMode) {
    const CRYSTAL_WHITE = "#e3f4ff";

    return (
      <div ref={rootRef}>
        <Panel title="Atributos" right="6 dominios">
          <AttributeRadar
            attributes={STATS.map((s) => ({
              key: s.key,
              abbr: s.abbr,
              icon: s.icon,
              value: character[s.key] + (character.bonusStats?.[s.key] ?? 0),
              max: s.key === "hp" ? 1000 : 100,
            }))}
          />

        <div className="mt-3 flex flex-col gap-1.5">
          {STATS.map((stat) => {
            const baseValue = character[stat.key];
            const bonusValue = character.bonusStats?.[stat.key] ?? 0;
            const max = stat.key === "hp" ? 1000 : 100;
            const basePct = Math.min((baseValue / max) * 100, 100);
            const bonusPct = Math.min((bonusValue / max) * 100, 100 - basePct);

            return (
              <div
                key={stat.key}
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: "20px 60px 1fr 56px" }}
              >
                {/* Icon */}
                <span
                  className="text-center text-[13px]"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    color: "var(--ember)",
                  }}
                >
                  {stat.icon}
                </span>

                {/* Abbr + tooltip */}
                <span className="flex items-center gap-1">
                  <span
                    className="text-[10px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                    }}
                  >
                    {stat.abbr}
                  </span>
                  <StatTooltip
                    statKey={stat.key}
                    label={stat.label}
                    isOpen={openStat === stat.key}
                    onToggle={setOpenStat}
                  />
                </span>

                {/* Bar (base + crystal bonus stacked) */}
                <div
                  className="flex h-[3px] w-full overflow-hidden rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--gold) 8%, transparent)",
                  }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${basePct}%`,
                      background: "linear-gradient(90deg, var(--gold), var(--ember))",
                      borderTopLeftRadius: 9999,
                      borderBottomLeftRadius: 9999,
                      borderTopRightRadius: bonusPct > 0 ? 0 : 9999,
                      borderBottomRightRadius: bonusPct > 0 ? 0 : 9999,
                    }}
                  />
                  {bonusPct > 0 && (
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${bonusPct}%`,
                        background: `linear-gradient(90deg, ${CRYSTAL_WHITE}, #ffffff)`,
                        boxShadow: `0 0 6px ${CRYSTAL_WHITE}, 0 0 2px #ffffff`,
                        borderTopRightRadius: 9999,
                        borderBottomRightRadius: 9999,
                      }}
                    />
                  )}
                </div>

                {/* Value (base + crystal bonus) */}
                <span
                  className="flex items-baseline justify-end gap-1 text-[12px] font-medium"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span className="text-white">{baseValue}</span>
                  {bonusValue > 0 && (
                    <span
                      className="text-[10px]"
                      style={{
                        color: CRYSTAL_WHITE,
                        textShadow: `0 0 4px ${CRYSTAL_WHITE}`,
                      }}
                    >
                      +{bonusValue}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Explicacao geral do calculo de dano */}
        <details
          className="mt-3"
          style={{
            fontFamily: "var(--font-garamond)",
            fontSize: 12,
            color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            borderTop: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
            paddingTop: 8,
          }}
        >
          <summary
            className="cursor-pointer"
            style={{
              fontFamily: "var(--font-cinzel)",
              fontSize: 9,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
              listStyle: "none",
            }}
          >
            Como o dano e calculado?
          </summary>
          <p className="mt-2" style={{ lineHeight: 1.5 }}>
            O dano final depende do seu Atributo de Ataque (Fisico ou Magico) vs a Defesa correspondente do alvo, somado ao poder da skill usada. Vulnerabilidades, status como BURN/FROZEN e buffs/debuffs ativos tambem afetam. Acima de tudo, builds focadas batem mais forte que builds dispersas.
          </p>
        </details>
        </Panel>
      </div>
    );
  }

  // Modo distribuicao
  return (
    <div ref={rootRef}>
      <Panel title="Forjar o Destino" right={`${remaining} / ${character.freePoints} livres`}>
        <div className="flex flex-col gap-2">
        {STATS.map((stat) => {
          const hasAllocation = allocation[stat.key] > 0;
          const preview = getPreviewValue(stat.key, "multiplier" in stat ? stat.multiplier : undefined);
          const canDecrement = allocation[stat.key] > 0;
          const canIncrement = remaining > 0;

          return (
            <div
              key={stat.key}
              className="grid items-center"
              style={{
                gridTemplateColumns: "28px 1fr auto",
                padding: "10px 12px",
                background: "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gold) 8%, transparent)",
              }}
            >
              {/* Icon */}
              <span
                className="text-[18px]"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  color: "var(--ember)",
                }}
              >
                {stat.icon}
              </span>

              {/* Info */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                    }}
                  >
                    {stat.label}
                  </span>
                  <StatTooltip
                    statKey={stat.key}
                    label={stat.label}
                    isOpen={openStat === stat.key}
                    onToggle={setOpenStat}
                  />
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[14px] text-white"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {character[stat.key]}
                  </span>
                  {hasAllocation && (
                    <>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--ember)" }}
                      >
                        &rarr;
                      </span>
                      <span
                        className="text-[14px] font-bold"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--ember)",
                        }}
                      >
                        {preview}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canDecrement}
                  onClick={() => handleDecrement(stat.key)}
                  className="flex cursor-pointer items-center justify-center transition-colors disabled:cursor-not-allowed"
                  style={{
                    width: 26,
                    height: 26,
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: canDecrement
                      ? "var(--ember)"
                      : "color-mix(in srgb, var(--gold) 20%, transparent)",
                    border: canDecrement
                      ? "1px solid var(--ember)"
                      : "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                    background: canDecrement
                      ? "color-mix(in srgb, var(--ember) 9%, transparent)"
                      : "transparent",
                  }}
                >
                  -
                </button>

                <button
                  type="button"
                  disabled={!canIncrement}
                  onClick={() => handleIncrement(stat.key)}
                  className="flex cursor-pointer items-center justify-center transition-colors disabled:cursor-not-allowed"
                  style={{
                    width: 26,
                    height: 26,
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: canIncrement
                      ? "var(--ember)"
                      : "color-mix(in srgb, var(--gold) 20%, transparent)",
                    border: canIncrement
                      ? "1px solid var(--ember)"
                      : "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                    background: canIncrement
                      ? "color-mix(in srgb, var(--ember) 9%, transparent)"
                      : "transparent",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {totalAllocated > 0 && (
        <div className="mt-4 flex flex-col items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="w-full cursor-pointer transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-cinzel)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.35em",
              padding: 12,
              ...(isSubmitting
                ? {
                    background: "var(--bg-secondary)",
                    border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
                    color: "color-mix(in srgb, var(--gold) 40%, transparent)",
                  }
                : {
                    background: "linear-gradient(135deg, var(--accent-primary), var(--ember))",
                    border: "1px solid var(--ember)",
                    color: "#fff",
                  }),
            }}
          >
            {isSubmitting ? "Forjando..." : "Confirmar"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer border-none bg-transparent"
            style={{
              fontFamily: "var(--font-garamond)",
              fontSize: 13,
              fontStyle: "italic",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              textDecoration: "underline",
              textDecorationColor: "color-mix(in srgb, var(--gold) 27%, transparent)",
            }}
          >
            Resetar
          </button>
        </div>
      )}
      </Panel>
    </div>
  );
}
