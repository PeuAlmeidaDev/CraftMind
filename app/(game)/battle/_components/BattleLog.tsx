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

const PHASE_STYLE: Record<string, { color: string; bold?: boolean; italic?: boolean }> = {
  DAMAGE: { color: "#ff8a70" },
  COUNTER: { color: "#ff8a70" },
  MISS: { color: "color-mix(in srgb, var(--gold) 60%, transparent)", italic: true },
  HEAL: { color: "#7acf8a" },
  HEALING: { color: "#7acf8a" },
  BUFF: { color: "#a78bfa" },
  COMBO: { color: "#a78bfa" },
  DEBUFF: { color: "#e0c85c" },
  STATUS: { color: "#e0c85c" },
  DEATH: { color: "#ff6a52", bold: true },
  INCAPACITATED: { color: "#e0c85c" },
  STUN: { color: "#e0c85c" },
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

// Icones por tipo de dano (PHYSICAL = espada, MAGICAL = cajado, NONE = brilho de suporte)
const PHYSICAL_ICON = "\u2694\uFE0F";
const MAGICAL_ICON = "\uD83E\uDE84";
const SUPPORT_ICON = "\u2728";

function getEventIcon(event: TurnLogEntry): string {
  if (event.phase === "DAMAGE" || event.phase === "COUNTER") {
    if (event.damageType === "PHYSICAL") return PHYSICAL_ICON;
    if (event.damageType === "MAGICAL") return MAGICAL_ICON;
    return SUPPORT_ICON;
  }
  return PHASE_ICON[event.phase] ?? "\u25B8";
}

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

function getSubText(event: TurnLogEntry): string | null {
  if (event.damage && event.damage > 0) return `${event.damage} de dano`;
  if (event.healing && event.healing > 0) return `${event.healing} de cura`;
  if (event.statusDamage && event.statusDamage > 0) return `${event.statusDamage} de dano (${event.statusApplied ?? "status"})`;
  if (event.buffApplied) return `${event.buffApplied.stat} +${event.buffApplied.value} (${event.buffApplied.duration}t)`;
  if (event.debuffApplied) return `${event.debuffApplied.stat} -${event.debuffApplied.value} (${event.debuffApplied.duration}t)`;
  return null;
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

      <div
        style={{
          background: "color-mix(in srgb, var(--bg-primary) 67%, transparent)",
          border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
          padding: "12px 14px",
        }}
      >
        <div
          className="flex justify-between items-center mb-2"
          style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: 9,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>
            Cronica do Combate
          </span>
          <span style={{ color: "color-mix(in srgb, var(--gold) 40%, transparent)" }}>
            {events.length} ev.
          </span>
        </div>

        {events.length === 0 ? (
          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-garamond)",
              fontStyle: "italic",
              color: "color-mix(in srgb, var(--gold) 53%, transparent)",
              fontSize: 13,
            }}
          >
            Aguardando primeiro turno...
          </p>
        ) : (
          <div
            ref={listRef}
            className="max-h-[220px] overflow-y-auto flex flex-col"
            style={{ gap: 4 }}
          >
            {events.map((event, idx) => {
              const phaseStyle = PHASE_STYLE[event.phase] ?? { color: "#d4d4d8" };
              const icon = getEventIcon(event);

              const isPlayer = !!event.actorId && event.actorId === playerId;
              const isMob = !!event.actorId && (event.actorId === mobId || (!isPlayer && !nameMap?.[event.actorId]));
              const isAlly = !!event.actorId && !isPlayer && !isMob && !!nameMap?.[event.actorId];

              const actorColor = isPlayer
                ? "var(--ember)"
                : (isMob ? "#d96a52" : (isAlly ? "var(--ember)" : "color-mix(in srgb, var(--gold) 40%, transparent)"));

              const bgColor = isPlayer
                ? "color-mix(in srgb, var(--ember) 4%, transparent)"
                : (isMob ? "color-mix(in srgb, #d96a52 4%, transparent)" : "transparent");

              const actorLabel = isPlayer
                ? playerName
                : isMob
                  ? mobName
                  : (event.actorId && nameMap?.[event.actorId])
                    ? nameMap[event.actorId]
                    : undefined;

              const subText = getSubText(event);

              return (
                <div
                  key={`${event.turn}-${event.phase}-${idx}`}
                  className="animate-battle-fade-in"
                  style={{
                    padding: "6px 8px",
                    borderLeft: `2px solid ${actorColor}`,
                    background: bgColor,
                  }}
                >
                  <div
                    className="flex items-baseline"
                    style={{ gap: 6 }}
                  >
                    <span
                      style={{
                        color: actorColor,
                        fontFamily: "var(--font-cormorant)",
                        fontSize: 14,
                      }}
                    >
                      {icon}
                    </span>

                    {actorLabel && (
                      <span
                        style={{
                          color: actorColor,
                          fontFamily: "var(--font-cormorant)",
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {actorLabel}
                      </span>
                    )}

                    <span
                      style={{
                        fontFamily: "var(--font-garamond)",
                        fontSize: 13,
                        color: phaseStyle.color,
                        fontWeight: phaseStyle.bold ? 700 : 400,
                        fontStyle: phaseStyle.italic ? "italic" : "normal",
                      }}
                    >
                      {replaceIds(event.message, playerId, playerName, mobId, mobName, nameMap)}
                    </span>
                  </div>

                  {subText && (
                    <div
                      style={{
                        fontFamily: "var(--font-jetbrains)",
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                        marginTop: 1,
                        marginLeft: 18,
                      }}
                    >
                      {"\u2192"} {subText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
