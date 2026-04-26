"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePvpTeamQueue } from "../_hooks/usePvpTeamQueue";

export default function PvpTeamMatchModal() {
  const router = useRouter();
  const {
    matchFound,
    matchData,
    matchAcceptTimeRemaining,
    matchAccepted,
    matchAcceptedCount,
    battleStarted,
    battleId,
    acceptMatch,
    declineMatch,
  } = usePvpTeamQueue();

  // Redirect when battle starts
  useEffect(() => {
    if (battleStarted && battleId) {
      router.push(`/pvp-team?battleId=${battleId}`);
    }
  }, [battleStarted, battleId, router]);

  if (!matchFound || !matchData) return null;

  const { teammates, opponents } = matchData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--accent-primary)] bg-[var(--bg-card)] p-6 shadow-2xl shadow-black/60">
        {/* Title */}
        <h2 className="text-center text-2xl font-bold text-emerald-400 mb-5">
          Match PvP Team Encontrado!
        </h2>

        {/* My Team */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">
            Seu Time
          </p>
          <div className="flex gap-3 justify-center">
            {teammates.map((mate) => (
              <div
                key={mate.userId}
                className="flex-1 max-w-[140px] rounded-lg border border-emerald-500/40 bg-emerald-900/20 p-3 text-center"
              >
                <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                  {mate.name.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-[11px] text-gray-300 truncate">
                  {mate.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            vs
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>

        {/* Opponents */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">
            Adversarios
          </p>
          <div className="flex gap-3 justify-center">
            {opponents.map((opp) => (
              <div
                key={opp.userId}
                className="flex-1 max-w-[140px] rounded-lg border border-red-500/40 bg-red-900/20 p-3 text-center"
              >
                <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-400">
                  {opp.name.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-[11px] text-gray-300 truncate">
                  {opp.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Timer + accepted count */}
        <div className="text-center mb-5">
          <p className="text-sm font-medium text-amber-400">
            Aceitar em: {matchAcceptTimeRemaining}s
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {matchAcceptedCount}/4 aceitaram
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={acceptMatch}
            disabled={matchAccepted}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
              matchAccepted
                ? "bg-emerald-600/50 cursor-not-allowed"
                : "bg-emerald-600 cursor-pointer hover:bg-emerald-500"
            }`}
          >
            {matchAccepted ? "Aceito!" : "Aceitar"}
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
    </div>
  );
}
