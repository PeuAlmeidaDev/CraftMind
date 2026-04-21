"use client";

import Image from "next/image";
import type { CoopPveTeammateInfo } from "../page";

type CoopPveTeamPanelProps = {
  teammates: CoopPveTeammateInfo[];
  currentPlayerId: string;
  actedPlayers: Set<string>;
  targeting: boolean;
  onAllyClick: (playerId: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
  BURN: "bg-orange-600/80 text-orange-100",
  POISON: "bg-green-700/80 text-green-100",
  FROZEN: "bg-cyan-700/80 text-cyan-100",
  STUN: "bg-amber-600/80 text-amber-100",
  SLOW: "bg-indigo-700/80 text-indigo-100",
};

const HOUSE_COLORS: Record<string, string> = {
  NOCTIS: "bg-indigo-800/60 text-indigo-200",
  LYCUS: "bg-cyan-800/60 text-cyan-200",
  IGNIS: "bg-red-800/60 text-red-200",
  SOLARA: "bg-amber-800/60 text-amber-200",
};

export default function CoopPveTeamPanel({
  teammates,
  currentPlayerId,
  actedPlayers,
  targeting,
  onAllyClick,
}: CoopPveTeamPanelProps) {
  return (
    <>
      <style>{`
        @keyframes coopAllyPulse {
          0%, 100% { border-color: var(--accent-secondary); box-shadow: 0 0 6px var(--accent-secondary); }
          50% { border-color: var(--accent-primary); box-shadow: 0 0 12px var(--accent-primary); }
        }
        .coop-ally-targeting {
          animation: coopAllyPulse 1.2s ease-in-out infinite;
        }
      `}</style>

      <div className="flex justify-center gap-3 md:gap-4">
        {teammates.map((player) => {
          const isCurrent = player.playerId === currentPlayerId;
          const isAlive = player.isAlive;
          const hasActed = actedPlayers.has(player.playerId);
          const isTargetable = targeting && isAlive && !isCurrent;
          const hpPercent =
            player.maxHp > 0 ? (player.currentHp / player.maxHp) * 100 : 0;
          const hpColor =
            hpPercent > 50 ? "bg-emerald-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
          const houseBadge = HOUSE_COLORS[player.houseName] ?? "bg-gray-700/60 text-gray-300";

          let statusBadge: { text: string; color: string };
          if (!isAlive) {
            statusBadge = { text: "Morto", color: "text-red-400" };
          } else if (isCurrent) {
            statusBadge = { text: "Voce", color: "text-[var(--accent-primary)]" };
          } else if (hasActed) {
            statusBadge = { text: "Agiu", color: "text-emerald-400" };
          } else {
            statusBadge = { text: "Pensando...", color: "text-yellow-400" };
          }

          return (
            <div
              key={player.playerId}
              onClick={() => {
                if (isTargetable) onAllyClick(player.playerId);
              }}
              className={`relative flex flex-col items-center rounded-xl border p-3 w-36 md:w-44 transition-all ${
                isCurrent
                  ? "border-[var(--accent-primary)]/60 bg-[var(--bg-card)]"
                  : isTargetable
                  ? "coop-ally-targeting cursor-pointer hover:scale-105 bg-[var(--bg-card)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
              } ${!isAlive ? "opacity-50 grayscale" : ""}`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] mb-2 flex items-center justify-center">
                {player.avatarUrl ? (
                  <Image
                    src={player.avatarUrl}
                    alt={player.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-sm font-bold text-gray-400">
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Name */}
              <p className="text-xs font-semibold text-white truncate max-w-full">
                {player.name}
              </p>

              {/* House badge */}
              <span className={`text-[9px] px-1.5 py-0.5 rounded mt-1 ${houseBadge}`}>
                {player.houseName}
              </span>

              {/* HP bar */}
              <div className="w-full mt-2">
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 text-center mt-0.5">
                  {player.currentHp}/{player.maxHp}
                </p>
              </div>

              {/* Status effects */}
              {player.statusEffects.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {player.statusEffects.map((se, idx) => (
                    <span
                      key={`${se.status}-${idx}`}
                      className={`text-[8px] px-1 py-0.5 rounded animate-pulse ${
                        STATUS_COLORS[se.status] ?? "bg-gray-600 text-gray-200"
                      }`}
                    >
                      {se.status} {se.remainingTurns}
                    </span>
                  ))}
                </div>
              )}

              {/* Status badge */}
              <p className={`text-[10px] font-medium mt-1.5 ${statusBadge.color}`}>
                {statusBadge.text}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
