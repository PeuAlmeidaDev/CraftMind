"use client";

import Image from "next/image";
import { getHouseAssets } from "@/lib/houses/house-assets";
import type { HouseName } from "@/types/house";

type PlayerStatusEffect = {
  status: string;
  remainingTurns: number;
};

export type TeamPlayerInfo = {
  playerId: string;
  name?: string;
  currentHp: number;
  maxHp: number;
  statusEffects: PlayerStatusEffect[];
  isAlive: boolean;
  avatarUrl?: string | null;
  houseName?: string;
};

type TeamPanelProps = {
  team: TeamPlayerInfo[];
  currentPlayerId: string;
  actedPlayers: Set<string>;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  STUN: { label: "Atordoado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  FROZEN: { label: "Congelado", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  BURN: { label: "Queimando", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  POISON: { label: "Envenenado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  SLOW: { label: "Lento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export default function TeamPanel({
  team,
  currentPlayerId,
  actedPlayers,
}: TeamPanelProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      {team.map((player, index) => {
        const isCurrentPlayer = player.playerId === currentPlayerId;
        const hasActed = actedPlayers.has(player.playerId);
        const hpPercent =
          player.maxHp > 0
            ? Math.max(0, Math.min(100, (player.currentHp / player.maxHp) * 100))
            : 0;

        const displayName = player.name ?? `Jogador ${index + 1}`;

        return (
          <div
            key={player.playerId}
            className={`flex-1 min-w-0 rounded-lg p-3 border ${
              isCurrentPlayer
                ? "border-2 border-emerald-400"
                : "border-[var(--border-subtle)]"
            } ${!player.isAlive ? "opacity-40" : ""}`}
            style={{
              background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
            }}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {player.avatarUrl ? (
                <Image
                  src={player.avatarUrl}
                  alt={displayName}
                  width={32}
                  height={32}
                  className="rounded-full object-cover border border-[var(--border-subtle)] shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 border border-[var(--border-subtle)]"
                  style={{ backgroundColor: "var(--accent-primary)" }}
                >
                  {(displayName[0] ?? "?").toUpperCase()}
                </div>
              )}

              {/* Conteudo (nome, HP, status) */}
              <div className="flex-1 min-w-0">
                {/* Name + house badge + status badges */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {displayName}
                  </span>

                  {/* Mini brasao/bandeira da casa */}
                  {player.houseName && (() => {
                    const assets = getHouseAssets(player.houseName as HouseName);
                    const src = assets.brasao ?? assets.bandeira;
                    return (
                      <Image
                        src={src}
                        alt={player.houseName}
                        width={20}
                        height={20}
                        className="object-contain shrink-0"
                      />
                    );
                  })()}

                  {!player.isAlive && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold shrink-0">
                      Morto
                    </span>
                  )}

                  {player.isAlive && hasActed && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                      Agiu
                    </span>
                  )}

                  {player.isAlive && !hasActed && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold shrink-0">
                      Pensando...
                    </span>
                  )}
                </div>

                {/* HP bar */}
                <div>
                  <div className="w-full h-2.5 rounded-full bg-emerald-950/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hpPercent}%`,
                        background: "linear-gradient(to right, #059669, #10b981)",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    HP: {player.currentHp} / {player.maxHp}
                  </p>
                </div>

                {/* Status effects */}
                {player.statusEffects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {player.statusEffects.map((effect) => {
                      const config = STATUS_CONFIG[effect.status];
                      const label = config?.label ?? effect.status;
                      const color =
                        config?.color ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";

                      return (
                        <span
                          key={effect.status}
                          className={`text-[9px] rounded-full px-1.5 py-0.5 border animate-pulse ${color}`}
                        >
                          {label} ({effect.remainingTurns})
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
