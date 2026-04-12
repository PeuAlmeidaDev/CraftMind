"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CoopBattleResultProps = {
  result: "VICTORY" | "DEFEAT";
  expGained: number;
  essenceGained: number;
  levelsGained: number;
  bossName: string;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESULT_CONFIG: Record<
  CoopBattleResultProps["result"],
  { icon: string; title: string; titleColor: string; sfx: string }
> = {
  VICTORY: {
    icon: "\uD83C\uDFC6",
    title: "VITORIA!",
    titleColor: "text-emerald-400",
    sfx: "/sfx/victory.mp3",
  },
  DEFEAT: {
    icon: "\uD83D\uDC80",
    title: "DERROTA",
    titleColor: "text-red-400",
    sfx: "/sfx/defeat.mp3",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoopBattleResult({
  result,
  expGained,
  essenceGained,
  levelsGained,
  bossName,
}: CoopBattleResultProps) {
  const router = useRouter();
  const config = RESULT_CONFIG[result];

  // Play SFX on mount
  useEffect(() => {
    const audio = new Audio(config.sfx);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }, [config.sfx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-coop-fade-in">
      <div
        className="max-w-md w-full mx-4 rounded-xl border border-[var(--border-subtle)] p-8 text-center animate-coop-scale-in"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
        }}
      >
        {/* Icon */}
        <div className="text-6xl">{config.icon}</div>

        {/* Title */}
        <h2 className={`text-2xl font-bold mt-4 ${config.titleColor}`}>
          {config.title}
        </h2>

        {/* Boss name */}
        <p className="text-sm text-gray-400 mt-1">{bossName}</p>

        {/* Rewards */}
        {result === "VICTORY" ? (
          <div className="mt-6 space-y-2">
            <p className="text-lg text-amber-400 font-semibold">
              EXP ganho: +{expGained}
            </p>

            {essenceGained > 0 && (
              <p className="text-sm text-amber-300 font-medium">
                +{essenceGained} Essencia de Boss
              </p>
            )}

            {levelsGained > 0 && (
              <p className="text-lg text-[var(--accent-primary)] font-bold animate-pulse">
                Level Up! (+{levelsGained})
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-gray-500">0 EXP</p>
          </div>
        )}

        {/* Button */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:brightness-110 transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes coopFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes coopScaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-coop-fade-in {
          animation: coopFadeIn 0.3s ease-out forwards;
        }
        .animate-coop-scale-in {
          animation: coopScaleIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
