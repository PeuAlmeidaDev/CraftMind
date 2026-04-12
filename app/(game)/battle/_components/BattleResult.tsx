"use client";

import { useEffect } from "react";

type BattleResultProps = {
  result: "VICTORY" | "DEFEAT" | "DRAW";
  expGained: number;
  levelsGained: number;
  newLevel: number;
  onPlayAgain: () => void;
  onGoHome: () => void;
};

const RESULT_CONFIG: Record<
  BattleResultProps["result"],
  { icon: string; title: string; titleColor: string; sfx: string }
> = {
  VICTORY: {
    icon: "🏆",
    title: "Vitoria!",
    titleColor: "text-emerald-400",
    sfx: "/sfx/victory.mp3",
  },
  DEFEAT: {
    icon: "💀",
    title: "Derrota",
    titleColor: "text-red-400",
    sfx: "/sfx/defeat.mp3",
  },
  DRAW: {
    icon: "🤝",
    title: "Empate",
    titleColor: "text-gray-400",
    sfx: "/sfx/defeat.mp3",
  },
};

export default function BattleResult({
  result,
  expGained,
  levelsGained,
  newLevel,
  onPlayAgain,
  onGoHome,
}: BattleResultProps) {
  const config = RESULT_CONFIG[result];

  // Play SFX on mount
  useEffect(() => {
    const audio = new Audio(config.sfx);
    audio.play().catch(() => {});
  }, [config.sfx]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
        {/* Icon */}
        <div className="text-6xl">{config.icon}</div>

        {/* Title */}
        <h2 className={`text-2xl font-bold mt-4 ${config.titleColor}`}>
          {config.title}
        </h2>

        {/* Stats (only on victory) */}
        {result === "VICTORY" && (
          <div className="mt-6 space-y-2">
            <p className="text-lg text-amber-400 font-semibold">
              EXP ganho: +{expGained}
            </p>
            {levelsGained > 0 && (
              <p className="text-lg text-[var(--accent-primary)] font-bold animate-pulse">
                Level Up! Nivel {newLevel}
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:brightness-110 transition"
          >
            Jogar novamente
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="w-full cursor-pointer rounded-lg py-3 text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
