"use client";

import { useEffect, useRef } from "react";
import type { TurnLogEntry } from "../page";

type BattleLogProps = {
  events: TurnLogEntry[];
  playerId?: string;
  playerName?: string;
  mobId?: string;
  mobName?: string;
  nameMap?: Record<string, string>;
};

const PHASE_STYLE: Record<string, string> = {
  DAMAGE: "text-red-400",
  COUNTER: "text-red-400",
  MISS: "text-gray-500 italic",
  HEAL: "text-emerald-400",
  HEALING: "text-emerald-400",
  BUFF: "text-blue-400",
  COMBO: "text-blue-400",
  DEBUFF: "text-amber-400",
  STATUS: "text-amber-400",
  DEATH: "text-red-500 font-bold",
  INCAPACITATED: "text-amber-500",
  STUN: "text-amber-500",
};

const PHASE_ICON: Record<string, string> = {
  DAMAGE: "\u2694\uFE0F",
  COUNTER: "\u2694\uFE0F",
  MISS: "\uD83D\uDCA8",
  HEAL: "\uD83D\uDC9A",
  HEALING: "\uD83D\uDC9A",
  BUFF: "\u2B06\uFE0F",
  COMBO: "\u2B06\uFE0F",
  DEBUFF: "\u2B07\uFE0F",
  STATUS: "\uD83D\uDD25",
  DEATH: "\uD83D\uDC80",
  INCAPACITATED: "\uD83D\uDE35",
  STUN: "\uD83D\uDE35",
};

function replaceIds(msg: string, playerId?: string, playerName?: string, mobId?: string, mobName?: string, nameMap?: Record<string, string>): string {
  let result = msg;
  if (playerId && playerName) result = result.replaceAll(playerId, playerName);
  if (mobId && mobName) result = result.replaceAll(mobId, mobName);
  if (nameMap) {
    for (const [id, name] of Object.entries(nameMap)) {
      result = result.replaceAll(id, name);
    }
  }
  return result;
}

export default function BattleLog({ events, playerId, playerName, mobId, mobName, nameMap }: BattleLogProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <>
      <style>{`
        @keyframes battleLogFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-battle-fade-in {
          animation: battleLogFadeIn 300ms ease-out forwards;
        }
      `}</style>

      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Combate
        </h3>

        {events.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center">
            Aguardando primeiro turno...
          </p>
        ) : (
          <div
            ref={listRef}
            className="max-h-[200px] overflow-y-auto space-y-1.5"
          >
            {events.map((event, idx) => {
              const style = PHASE_STYLE[event.phase] ?? "text-gray-300";
              const icon = PHASE_ICON[event.phase] ?? "\u25B8";

              const isPlayer = !!event.actorId && event.actorId === playerId;
              const isMob = !!event.actorId && event.actorId === mobId;

              const borderClass = isPlayer
                ? "border-l-amber-400"
                : isMob
                  ? "border-l-red-500"
                  : "border-l-zinc-600";

              const bgClass = isPlayer
                ? "bg-amber-400/5"
                : isMob
                  ? "bg-red-500/5"
                  : "";

              const actorLabel = isPlayer
                ? playerName
                : isMob
                  ? mobName
                  : undefined;

              const labelColorClass = isPlayer
                ? "text-amber-400"
                : "text-red-400";

              return (
                <p
                  key={`${event.turn}-${event.phase}-${idx}`}
                  className={`text-sm border-l-3 pl-2 rounded-sm ${borderClass} ${bgClass} animate-battle-fade-in`}
                >
                  <span className="mr-1">{icon}</span>
                  {actorLabel && (
                    <span className={`${labelColorClass} font-semibold text-xs`}>
                      {actorLabel}
                      {" — "}
                    </span>
                  )}
                  <span className={style}>
                    {replaceIds(event.message, playerId, playerName, mobId, mobName, nameMap)}
                  </span>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
