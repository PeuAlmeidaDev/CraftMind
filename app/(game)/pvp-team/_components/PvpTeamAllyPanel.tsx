"use client";

import Image from "next/image";
import SkillVfx from "../../battle/_components/SkillVfx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeammateInfo = {
  playerId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: { status: string; remainingTurns: number }[];
  isAlive: boolean;
  avatarUrl: string | null;
  houseName: string;
};

type PvpTeamAllyPanelProps = {
  teammates: TeammateInfo[];
  currentPlayerId: string;
  actedPlayers: Set<string>;
  targeting: boolean;
  onAllyClick: (playerId: string) => void;
  vfxTargetPlayerId?: string | null;
  vfxSkillName?: string | null;
  onVfxComplete?: () => void;
  disconnectedPlayers: Set<string>;
  autoSkipPlayers: Set<string>;
};

// ---------------------------------------------------------------------------
// Constants (same as CoopPveTeamPanel)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PvpTeamAllyPanel({
  teammates,
  currentPlayerId,
  actedPlayers,
  targeting,
  onAllyClick,
  vfxTargetPlayerId = null,
  vfxSkillName = null,
  onVfxComplete,
  disconnectedPlayers,
  autoSkipPlayers,
}: PvpTeamAllyPanelProps) {
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

      <div className={`flex justify-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-1 ${teammates.length >= 3 ? "flex-wrap sm:flex-nowrap" : ""}`}>
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
          const isDisconnected = disconnectedPlayers.has(player.playerId);
          const isAutoSkip = autoSkipPlayers.has(player.playerId);

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
              className={`relative flex flex-col items-center rounded-xl border p-2 sm:p-3 shrink-0 transition-all ${
                teammates.length >= 3 ? "w-24 min-w-24 sm:w-32 sm:min-w-32 md:w-40 md:min-w-40" : "w-28 min-w-28 sm:w-36 sm:min-w-36 md:w-44 md:min-w-44"
              } ${
                isCurrent
                  ? "border-[var(--accent-primary)]/60 bg-[var(--bg-card)]"
                  : isTargetable
                  ? "coop-ally-targeting cursor-pointer hover:scale-105 bg-[var(--bg-card)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
              } ${!isAlive ? "opacity-50 grayscale" : ""}`}
            >
              {/* Avatar (identical to CoopPveTeamPanel) */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] mb-1.5 sm:mb-2 flex items-center justify-center">
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

              {/* Name (identical to CoopPveTeamPanel) */}
              <p className="text-[11px] sm:text-xs font-semibold text-white truncate max-w-full">
                {player.name}
              </p>

              {/* House badge (identical to CoopPveTeamPanel) */}
              <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded mt-0.5 sm:mt-1 ${houseBadge}`}>
                {player.houseName}
              </span>

              {/* Disconnected / Auto-skip badges */}
              {(isDisconnected || isAutoSkip) && (
                <div className="flex gap-0.5 mt-0.5">
                  {isDisconnected && (
                    <span className="text-[7px] px-1 py-0.5 rounded bg-orange-600/80 text-orange-100 font-semibold">
                      OFFLINE
                    </span>
                  )}
                  {isAutoSkip && !isDisconnected && (
                    <span className="text-[7px] px-1 py-0.5 rounded bg-gray-600/80 text-gray-200 font-semibold">
                      AUTO-SKIP
                    </span>
                  )}
                </div>
              )}

              {/* HP bar (identical to CoopPveTeamPanel) */}
              <div className="w-full mt-1.5 sm:mt-2">
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <p className="text-[8px] sm:text-[9px] text-gray-400 text-center mt-0.5">
                  {player.currentHp}/{player.maxHp}
                </p>
              </div>

              {/* Status effects (identical to CoopPveTeamPanel) */}
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

              {/* Skill VFX overlay (identical to CoopPveTeamPanel) */}
              {onVfxComplete && (
                <SkillVfx
                  skillName={vfxTargetPlayerId === player.playerId ? vfxSkillName : null}
                  visible={vfxTargetPlayerId === player.playerId}
                  onComplete={onVfxComplete}
                />
              )}

              {/* Status badge (identical to CoopPveTeamPanel) */}
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
