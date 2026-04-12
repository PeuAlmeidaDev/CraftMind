"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBossQueue } from "../_hooks/useBossQueue";

export default function BossMatchModal() {
  const router = useRouter();
  const {
    matchFound,
    matchData,
    matchAcceptTimeRemaining,
    battleStarted,
    battleId,
    acceptMatch,
    declineMatch,
  } = useBossQueue();

  // Redirect when battle starts
  useEffect(() => {
    if (battleStarted && battleId) {
      const bossNameParam = matchData?.boss.name ? `&bossName=${encodeURIComponent(matchData.boss.name)}` : "";
      router.push(`/boss-fight?battleId=${battleId}${bossNameParam}`);
    }
  }, [battleStarted, battleId, router]);

  if (!matchFound || !matchData) return null;

  const { boss, teammates } = matchData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--accent-primary)] bg-[var(--bg-card)] p-6 shadow-2xl shadow-black/60">
        {/* Title */}
        <h2 className="text-center text-2xl font-bold text-emerald-400 mb-5">
          Match Encontrado!
        </h2>

        {/* Boss card */}
        <div className="rounded-lg border border-red-500/40 bg-black/30 p-4 mb-5">
          <p className="text-lg font-bold text-red-400 text-center">
            {boss.name}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            Tier {boss.tier} | {boss.category}
          </p>
        </div>

        {/* Teammates */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">
            Companheiros
          </p>
          <div className="flex gap-3 justify-center">
            {teammates.map((mate) => (
              <div
                key={mate.userId}
                className="flex-1 max-w-[140px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-center"
              >
                <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)]/20 text-sm font-bold text-[var(--accent-primary)]">
                  {mate.userId.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-[11px] text-gray-400 truncate">
                  {mate.userId.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Timer */}
        <p className="text-center text-sm font-medium text-amber-400 mb-5">
          Aceitar em: {matchAcceptTimeRemaining}s
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={acceptMatch}
            className="flex-1 cursor-pointer rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Aceitar
          </button>
          <button
            type="button"
            onClick={declineMatch}
            className="flex-1 cursor-pointer rounded-lg bg-red-600/80 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            Recusar
          </button>
        </div>
      </div>

      {/* Glow animation */}
      <style>{`
        @keyframes matchGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.4); }
        }
      `}</style>
    </div>
  );
}
