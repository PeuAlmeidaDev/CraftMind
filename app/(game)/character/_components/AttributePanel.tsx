"use client";

import { useState } from "react";
import type { Character } from "@/types/character";

type Props = {
  character: Character;
  onDistribute: (updatedCharacter: Character) => void;
};

const STATS = [
  { key: "physicalAtk" as const, label: "Ataque Fisico", icon: "⚔️" },
  { key: "physicalDef" as const, label: "Defesa Fisica", icon: "🛡️" },
  { key: "magicAtk" as const, label: "Ataque Magico", icon: "✨" },
  { key: "magicDef" as const, label: "Defesa Magica", icon: "🔮" },
  { key: "hp" as const, label: "Vida", icon: "❤️", multiplier: 10 },
  { key: "speed" as const, label: "Velocidade", icon: "💨" },
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

export default function AttributePanel({ character, onDistribute }: Props) {
  const [allocation, setAllocation] = useState<Record<StatKey, number>>({ ...INITIAL_ALLOCATION });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAllocated = Object.values(allocation).reduce((sum, v) => sum + v, 0);
  const remaining = character.freePoints - totalAllocated;
  const isDistributeMode = character.freePoints > 0;

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
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/character/distribute-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="mb-3 text-lg font-semibold">Atributos</h2>
        <ul className="space-y-2">
          {STATS.map((stat) => (
            <li key={stat.key} className="flex items-center justify-between">
              <span>
                {stat.icon} {stat.label}
              </span>
              <span className="font-bold">{character[stat.key]}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Modo distribuicao
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Atributos</h2>
        <span className="rounded-full bg-[var(--accent-primary)] px-2 py-0.5 text-xs font-medium text-white">
          {remaining} pontos livres
        </span>
      </div>

      <ul className="space-y-2">
        {STATS.map((stat) => {
          const hasAllocation = allocation[stat.key] > 0;
          const preview = getPreviewValue(stat.key, "multiplier" in stat ? stat.multiplier : undefined);

          return (
            <li key={stat.key}>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {stat.icon} {stat.label}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={allocation[stat.key] === 0}
                    onClick={() => handleDecrement(stat.key)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-[var(--bg-secondary)] text-sm font-bold transition-colors hover:bg-[var(--accent-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    -
                  </button>

                  <span className="min-w-[2rem] text-center text-sm">
                    {character[stat.key]}
                  </span>

                  {hasAllocation && (
                    <>
                      <span className="text-xs text-gray-400">&rarr;</span>
                      <span className="min-w-[2rem] text-center text-sm font-bold text-[var(--accent-primary)]">
                        {preview}
                      </span>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={remaining === 0}
                    onClick={() => handleIncrement(stat.key)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-[var(--bg-secondary)] text-sm font-bold transition-colors hover:bg-[var(--accent-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {stat.key === "hp" && (
                <p className="mt-0.5 text-xs text-gray-500">(cada ponto = +10 HP)</p>
              )}
            </li>
          );
        })}
      </ul>

      {totalAllocated > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Distribuindo..." : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer text-xs text-gray-400 underline hover:text-gray-300"
          >
            Resetar
          </button>
        </div>
      )}
    </div>
  );
}
