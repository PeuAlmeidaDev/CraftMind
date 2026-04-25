"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { expToNextLevel } from "@/lib/exp/formulas";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import type { DailyTask, CompleteTaskResponse } from "@/types/task";
import type { Character } from "@/types/character";
import type { HabitCategory } from "@/types/habit";
import type { CharacterSkillSlot } from "@/types/skill";
import type { CalendarDay } from "@/types/task";
import { useBossQueue } from "../_hooks/useBossQueue";
import { ATTRIBUTE_META, CATEGORY_COLORS, CATEGORY_LABEL } from "./_components/constants";
import { HOUSE_LORE, getPlayerTitle } from "@/lib/constants-house";
import ActivityCalendar from "./_components/ActivityCalendar";
import EquippedSkillsPreview from "./_components/EquippedSkillsPreview";
import AttributeRadar from "@/components/ui/AttributeRadar";
import Panel from "@/components/ui/Panel";
import EmberField from "@/components/ui/EmberField";

// ---------------------------------------------------------------------------
// Category color mapping for task ribbons
// ---------------------------------------------------------------------------

const CATEGORY_RIBBON: Record<string, string> = {
  PHYSICAL: "#ff6b6b",
  INTELLECTUAL: "#6b9dff",
  MENTAL: "#b06bff",
  SOCIAL: "#ffb86b",
  SPIRITUAL: "#6bffb8",
};

const CATEGORY_DOT: Record<string, string> = {
  PHYSICAL: "#ff8a8a",
  INTELLECTUAL: "#8ab5ff",
  MENTAL: "#c98aff",
  SOCIAL: "#ffc98a",
  SPIRITUAL: "#8affc9",
};

// ---------------------------------------------------------------------------
// Componentes internos — estilo mockup
// ---------------------------------------------------------------------------

function DailyProgressArc({ done, total, streak }: { done: number; total: number; streak: number }) {
  const pct = total > 0 ? done / total : 0;
  const size = 160;
  const r = 66;
  const c = 2 * Math.PI * r;
  const SWEEP = 0.78;
  const arcLen = c * SWEEP;
  const filled = arcLen * pct;

  return (
    <Panel title="Progresso Diario">
      <div className="relative flex flex-col items-center gap-2.5">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--ember) 14%, transparent))" }}
        >
          <defs>
            <linearGradient id="arcFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gold)" />
              <stop offset="60%" stopColor="var(--ember)" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="color-mix(in srgb, var(--gold) 14%, transparent)"
            strokeWidth="3"
            strokeDasharray={`${arcLen} ${c}`}
            transform={`rotate(${90 + (1 - SWEEP) * 180} ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
          {/* Filled arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#arcFill)"
            strokeWidth="3"
            strokeDasharray={`${filled} ${c}`}
            transform={`rotate(${90 + (1 - SWEEP) * 180} ${size / 2} ${size / 2})`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 500ms ease-out" }}
          />
          {/* Checkpoint pips */}
          {Array.from({ length: total }).map((_, i) => {
            const t = total === 1 ? 0.5 : i / (total - 1);
            const ang = ((90 + (1 - SWEEP) * 180 + t * SWEEP * 360) * Math.PI) / 180;
            const cx = size / 2 + Math.cos(ang) * r;
            const cy = size / 2 + Math.sin(ang) * r;
            const isFilled = i < done;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isFilled ? 4 : 2.5}
                fill={isFilled ? "var(--ember)" : "color-mix(in srgb, var(--gold) 27%, transparent)"}
                stroke={isFilled ? "#fff" : "none"}
                strokeWidth="0.5"
                style={{
                  filter: isFilled
                    ? "drop-shadow(0 0 2px color-mix(in srgb, var(--ember) 67%, transparent))"
                    : "none",
                }}
              />
            );
          })}
        </svg>

        {/* Centre readout */}
        <div className="pointer-events-none absolute inset-0 -top-5 flex flex-col items-center justify-center">
          <div style={{ fontFamily: "var(--font-cormorant)", marginBottom: 6 }}>
            <span className="text-4xl font-light" style={{ color: "var(--ember)", letterSpacing: "-0.02em" }}>
              {done}
            </span>
            <span className="mx-1 text-xl" style={{ color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}>
              /
            </span>
            <span className="text-4xl font-light" style={{ color: "var(--ember)", letterSpacing: "-0.02em" }}>
              {total}
            </span>
          </div>
          <span
            className="mt-0.5 text-[8px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Tarefas do dia
          </span>

        </div>

        {/* Streak ribbon */}
        <div
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "color-mix(in srgb, var(--gold) 87%, transparent)",
          }}
        >
          <span style={{ color: "var(--ember)", fontSize: 12 }}>&#9670;</span>
          <span>{streak} dias · vigilia continua</span>
          <span style={{ color: "var(--ember)", fontSize: 12 }}>&#9670;</span>
        </div>
      </div>
    </Panel>
  );
}

function AttributePanel({
  character,
  highlightedKeys,
}: {
  character: Character | null;
  highlightedKeys: Set<string>;
}) {
  if (character === null) {
    return (
      <Panel title="Atributos" right="6 dominios">
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse"
              style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)" }}
            />
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Atributos" right="6 dominios">
      {/* Radar chart */}
      <AttributeRadar
        attributes={ATTRIBUTE_META.map(({ key, abbr, icon }) => ({
          key,
          abbr,
          icon,
          value: character[key] as number,
          max: key === "hp" ? 1000 : 100,
        }))}
      />

      {/* Attribute bars */}
      <div className="mt-3.5 flex flex-col gap-1.5">
        {ATTRIBUTE_META.map(({ key, label, icon }) => {
          const value = character[key] as number;
          const max = key === "hp" ? 1000 : 100;
          const highlighted = highlightedKeys.has(key);

          return (
            <div
              key={key}
              className="grid items-center gap-2 transition-all duration-700"
              style={{
                gridTemplateColumns: "18px 60px 1fr 32px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                background: highlighted
                  ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)"
                  : "transparent",
                padding: "2px 4px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: 13,
                  color: "var(--ember)",
                }}
              >
                {icon}
              </span>
              <span style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>
                {label.split(" ")[0]?.slice(0, 6).toUpperCase()}
              </span>
              <span
                className="relative h-[3px]"
                style={{
                  background: "color-mix(in srgb, var(--gold) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                }}
              >
                <span
                  className="absolute inset-0"
                  style={{
                    width: `${Math.min(100, (value / max) * 100)}%`,
                    background: "linear-gradient(90deg, var(--gold), var(--ember))",
                    boxShadow: "0 0 6px color-mix(in srgb, var(--ember) 40%, transparent)",
                    transition: "width 400ms ease-out",
                  }}
                />
              </span>
              <span className="text-right text-white">{value}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TaskCard({
  task,
  onComplete,
  completing,
}: {
  task: DailyTask;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const catColor = CATEGORY_RIBBON[task.habitCategory] ?? "#999";
  const catDot = CATEGORY_DOT[task.habitCategory] ?? "#aaa";

  const grants = task.attributeGrants;
  const grantEntries = ATTRIBUTE_META.filter(
    ({ grantKey }) =>
      grants[grantKey as keyof typeof grants] !== undefined &&
      (grants[grantKey as keyof typeof grants] as number) > 0,
  );
  const rewardBits = grantEntries
    .map(({ grantKey, icon }) => `${icon}+${grants[grantKey as keyof typeof grants]}`)
    .join(" · ");

  return (
    <article
      className="relative grid transition-all duration-250"
      style={{
        gridTemplateColumns: "4px 1fr auto",
        gap: 14,
        padding: "12px 14px",
        background: task.completed
          ? "linear-gradient(90deg, color-mix(in srgb, var(--bg-secondary) 33%, transparent) 0%, transparent 60%)"
          : "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
        border: "1px solid color-mix(in srgb, var(--gold) 8%, transparent)",
        opacity: task.completed ? 0.6 : 1,
      }}
    >
      {/* Category ribbon */}
      <div
        style={{
          background: catColor,
          boxShadow: `0 0 5px ${catColor}55`,
          opacity: task.completed ? 0.4 : 1,
        }}
      />

      {/* Text */}
      <div className="min-w-0">
        <div
          className="mb-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.25em]"
          style={{ fontFamily: "var(--font-mono)", color: catDot }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: catDot, boxShadow: `0 0 3px ${catDot}aa` }}
          />
          {CATEGORY_LABEL[task.habitCategory as HabitCategory] ?? task.habitCategory}
          {rewardBits && (
            <>
              <span style={{ color: "color-mix(in srgb, var(--gold) 33%, transparent)", marginLeft: 4 }}>·</span>
              <span style={{ color: "color-mix(in srgb, var(--gold) 53%, transparent)" }}>{rewardBits}</span>
            </>
          )}
        </div>
        <div
          className="text-[15px]"
          style={{
            fontFamily: "var(--font-garamond)",
            color: task.completed
              ? "color-mix(in srgb, var(--gold) 60%, transparent)"
              : "#f0e6e0",
            textDecorationLine: task.completed ? "line-through" : "none",
            textDecorationColor: "color-mix(in srgb, var(--gold) 40%, transparent)",
            textDecorationStyle: "solid",
          }}
        >
          {task.description}
        </div>
      </div>

      {/* Action */}
      <button
        onClick={() => onComplete(task.id)}
        disabled={task.completed || completing}
        className="cursor-pointer self-center text-[10px] uppercase tracking-[0.25em] transition-all duration-150 disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-cinzel)",
          padding: "8px 14px",
          color: task.completed
            ? "color-mix(in srgb, var(--gold) 80%, transparent)"
            : "var(--ember)",
          background: task.completed
            ? "transparent"
            : "linear-gradient(180deg, color-mix(in srgb, var(--ember) 14%, transparent) 0%, color-mix(in srgb, var(--ember) 4%, transparent) 100%)",
          border: task.completed
            ? "1px solid color-mix(in srgb, var(--gold) 33%, transparent)"
            : "1px solid var(--ember)",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!task.completed) {
            (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--ember) 27%, transparent)";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }
        }}
        onMouseLeave={(e) => {
          if (!task.completed) {
            (e.currentTarget as HTMLButtonElement).style.background =
              "linear-gradient(180deg, color-mix(in srgb, var(--ember) 14%, transparent) 0%, color-mix(in srgb, var(--ember) 4%, transparent) 100%)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ember)";
          }
        }}
      >
        {task.completed ? "\u2713 Feita" : completing ? "..." : "Cumprir"}
      </button>
    </article>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse"
          style={{
            background: "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
            border: "1px solid color-mix(in srgb, var(--gold) 8%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

function PlayerHeader({
  character,
  playerName,
  avatarUrl,
  houseName,
}: {
  character: Character | null;
  playerName: string | null;
  avatarUrl: string | null;
  houseName: string | null;
}) {
  if (character === null) {
    return (
      <Panel style={{ overflow: "hidden" }}>
        <div className="p-4 sm:px-7 sm:py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div
              className="h-16 w-16 shrink-0 animate-pulse rounded-full sm:h-[104px] sm:w-[104px]"
              style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
            />
            <div className="flex-1 space-y-3">
              <div className="mx-auto h-3 w-32 animate-pulse sm:mx-0" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)" }} />
              <div className="mx-auto h-8 w-48 animate-pulse sm:mx-0" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)" }} />
              <div className="h-[6px] w-full animate-pulse" style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)" }} />
            </div>
            <div
              className="h-16 w-16 shrink-0 animate-pulse rounded-full sm:h-[92px] sm:w-[92px]"
              style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
            />
          </div>
        </div>
      </Panel>
    );
  }

  const needed = expToNextLevel(character.level);
  const pct = needed === 0 ? 100 : Math.min(100, Math.round((character.currentExp / needed) * 100));
  const lore = houseName ? HOUSE_LORE[houseName] : null;
  const title = getPlayerTitle(character.level);
  const displayHouse = houseName
    ? houseName.charAt(0) + houseName.slice(1).toLowerCase()
    : null;

  return (
    <Panel style={{ overflow: "hidden" }}>
      <div className="p-4 sm:px-7 sm:py-6">
      {/* Watermark — nome da casa */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 select-none text-[120px] sm:text-[240px]"
        style={{
          fontFamily: "var(--font-cinzel)",
          lineHeight: 1,
          fontWeight: 600,
          color: "var(--ember)",
          opacity: 0.04,
          letterSpacing: "0.04em",
        }}
      >
        {houseName ?? "CRAFT"}
      </div>

      <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:gap-5">
        {/* Avatar a esquerda */}
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full sm:h-[104px] sm:w-[104px]"
          style={{
            border: "1px solid color-mix(in srgb, var(--ember) 33%, transparent)",
            background: avatarUrl
              ? "transparent"
              : `repeating-linear-gradient(135deg, var(--bg-secondary) 0 6px, var(--bg-primary) 6px 12px),
                 radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--ember) 9%, transparent) 0%, transparent 65%)`,
            boxShadow: "0 0 0 3px var(--bg-primary), 0 0 0 4px color-mix(in srgb, var(--gold) 20%, transparent), 0 0 14px color-mix(in srgb, var(--ember) 9%, transparent)",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span
              className="text-3xl font-light italic sm:text-5xl"
              style={{
                fontFamily: "var(--font-cormorant)",
                color: "var(--ember)",
                textShadow: "0 0 6px color-mix(in srgb, var(--ember) 33%, transparent)",
              }}
            >
              {playerName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>

        {/* Centro: eyebrow + nome + motto + XP */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-between gap-2 sm:items-start">
          <div className="text-center sm:text-left">
            <div
              className="mb-1.5 text-[10px] uppercase tracking-[0.35em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              }}
            >
              {displayHouse ? `Casa de ${displayHouse} \u00B7 ${title}` : title}
            </div>
            <div
              className="text-2xl font-normal leading-none text-white sm:text-[34px]"
              style={{ fontFamily: "var(--font-cormorant)", letterSpacing: "0.01em" }}
            >
              {playerName ?? "Aventureiro"}
            </div>
            {lore && (
              <div
                className="mt-1 text-[13px] italic"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 67%, transparent)",
                }}
              >
                &laquo; {lore.motto} &raquo;
              </div>
            )}
          </div>

          {/* XP bar */}
          <div className="w-full">
            <div
              className="mb-1.5 flex items-baseline justify-between text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>XP</span>
              <span style={{ color: "var(--ember)" }}>
                {character.currentExp.toLocaleString()} / {needed.toLocaleString()}
              </span>
            </div>
            <div
              className="relative h-[6px]"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
              }}
            >
              <div
                className="absolute inset-0 transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--gold) 0%, var(--ember) 100%)",
                  boxShadow: "0 0 5px color-mix(in srgb, var(--ember) 40%, transparent), inset 0 0 3px color-mix(in srgb, var(--gold) 47%, transparent)",
                }}
              />
              {[0.25, 0.5, 0.75].map((t) => (
                <div
                  key={t}
                  className="absolute -bottom-0.5 -top-0.5 w-px"
                  style={{ left: `${t * 100}%`, background: "color-mix(in srgb, var(--gold) 33%, transparent)" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Nivel a direita */}
        <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-auto">
          <div
            className="relative grid h-16 w-16 place-items-center rounded-full sm:h-[92px] sm:w-[92px]"
            style={{
              background: "radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent-primary) 53%, transparent) 0%, var(--bg-secondary) 65%)",
              border: "1px solid color-mix(in srgb, var(--ember) 33%, transparent)",
              boxShadow: `
                0 0 0 6px var(--bg-primary),
                0 0 0 7px color-mix(in srgb, var(--gold) 20%, transparent),
                0 0 14px color-mix(in srgb, var(--ember) 14%, transparent),
                inset 0 0 14px color-mix(in srgb, var(--accent-primary) 20%, transparent)`,
            }}
          >
            <svg viewBox="0 0 92 92" className="pointer-events-none absolute inset-0 h-full w-full">
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i / 24) * Math.PI * 2;
                return (
                  <line key={i}
                    x1={46 + Math.cos(a) * 44} y1={46 + Math.sin(a) * 44}
                    x2={46 + Math.cos(a) * 46.5} y2={46 + Math.sin(a) * 46.5}
                    stroke="color-mix(in srgb, var(--gold) 53%, transparent)" strokeWidth="0.8"
                  />
                );
              })}
            </svg>
            <div className="text-center leading-none">
              <div className="text-[7px] uppercase tracking-[0.2em] sm:text-[9px] sm:tracking-[0.4em]"
                style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>
                NIVEL
              </div>
              <div className="mt-0.5 text-3xl font-medium text-white sm:text-[44px]"
                style={{ fontFamily: "var(--font-cormorant)", textShadow: "0 0 7px color-mix(in srgb, var(--ember) 47%, transparent)" }}>
                {character.level}
              </div>
            </div>
          </div>

          {character.freePoints > 0 && (
            <Link href="/character"
              className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-white"
              style={{
                fontFamily: "var(--font-cinzel)",
                padding: "7px 14px",
                background: "linear-gradient(135deg, color-mix(in srgb, var(--ember) 20%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 40%, transparent) 100%)",
                border: "1px solid var(--ember)",
                animation: "freePulse 1.8s ease-in-out infinite",
              }}>
              &#10022; {character.freePoints} pontos livres &#10022;
            </Link>
          )}
        </div>
      </div>
      </div>
    </Panel>
  );
}

function BattleActions({
  eligible,
  alreadyParticipated,
  dominantCategory,
  inQueue,
  onJoin,
}: {
  eligible: boolean;
  alreadyParticipated: boolean;
  dominantCategory: string | null;
  inQueue: boolean;
  onJoin: (category: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Primary CTA */}
      <Link
        href="/battle"
        className="group relative block w-full overflow-hidden text-center text-sm uppercase tracking-[0.4em] text-white transition-transform duration-150 hover:-translate-y-px"
        style={{
          fontFamily: "var(--font-cinzel)",
          padding: "18px 22px",
          background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--ember) 100%)",
          border: "1px solid var(--ember)",
          boxShadow:
            "0 0 12px color-mix(in srgb, var(--ember) 20%, transparent), inset 0 0 8px color-mix(in srgb, var(--gold) 14%, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute inset-1.5"
          style={{ border: "1px solid color-mix(in srgb, var(--gold) 33%, transparent)" }}
        />
        &#9876; Batalhar &#9876;
      </Link>

      {/* Boss Fight */}
      {alreadyParticipated || !eligible ? (
        <article
          className="p-4 text-center opacity-55"
          style={{ border: "1px dashed color-mix(in srgb, var(--gold) 20%, transparent)" }}
        >
          <div
            className="mb-1.5 text-[10px] uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 67%, transparent)" }}
          >
            &#9671; Boss Fight · Selado
          </div>
          <div
            className="text-xs italic"
            style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 53%, transparent)" }}
          >
            Nenhuma investida disponivel ate a proxima lua.
          </div>
        </article>
      ) : (
        <article
          className="relative overflow-hidden p-4"
          style={{
            background: `
              radial-gradient(ellipse at 20% 20%, color-mix(in srgb, var(--ember) 14%, transparent) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 100%, color-mix(in srgb, var(--accent-primary) 27%, transparent) 0%, transparent 60%),
              linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)`,
            border: "1px solid color-mix(in srgb, var(--ember) 33%, transparent)",
            boxShadow:
              "0 0 14px color-mix(in srgb, var(--ember) 9%, transparent), inset 0 0 14px color-mix(in srgb, var(--accent-primary) 14%, transparent)",
          }}
        >
          {/* Pulsing corner */}
          <div
            className="pointer-events-none absolute -right-2.5 -top-2.5 h-20 w-20 rounded-full"
            style={{
              background: "radial-gradient(circle, color-mix(in srgb, var(--ember) 20%, transparent) 0%, transparent 70%)",
              animation: "bossPulse 2.4s ease-in-out infinite",
            }}
          />

          <div
            className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.4em]"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--ember)" }}
          >
            <span>&#9672; Boss Fight · {inQueue ? "Na Fila" : "Disponivel"}</span>
            <span
              className="text-[8px]"
              style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
            >
              18h–22h
            </span>
          </div>
          <div
            className="mb-1 text-[19px] font-medium leading-tight text-white"
            style={{ fontFamily: "var(--font-cormorant)", textWrap: "balance" }}
          >
            Arauto da Penumbra
          </div>
          <div
            className="mb-2.5 text-[9px] tracking-[0.15em]"
            style={{ fontFamily: "var(--font-mono)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
          >
            BOSS · 3v1 COOP
          </div>
          <div
            className="mb-3 text-xs italic"
            style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 87%, transparent)" }}
          >
            Recompensa: EXP bonus · Fragmento do Veu
          </div>
          <button
            type="button"
            onClick={() => { if (dominantCategory) onJoin(dominantCategory); }}
            disabled={inQueue}
            className="w-full cursor-pointer text-[11px] uppercase tracking-[0.3em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              fontFamily: "var(--font-cinzel)",
              padding: "10px",
              color: inQueue ? "color-mix(in srgb, var(--gold) 60%, transparent)" : "var(--ember)",
              background: "transparent",
              border: `1px solid ${inQueue ? "color-mix(in srgb, var(--gold) 33%, transparent)" : "var(--ember)"}`,
            }}
          >
            {inQueue ? "Aguardando..." : "Enfrentar o Arauto"}
          </button>
        </article>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [houseName, setHouseName] = useState<string | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const [skills, setSkills] = useState<CharacterSkillSlot[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [bossEligible, setBossEligible] = useState(false);
  const [bossDominantCategory, setBossDominantCategory] = useState<string | null>(null);
  const [bossAlreadyParticipated, setBossAlreadyParticipated] = useState(false);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { joinQueue, inQueue } = useBossQueue();

  // Buscar calendario por mes (com AbortSignal)
  const fetchCalendar = useCallback(async (year: number, month: number, signal?: AbortSignal) => {
    const token = getToken();
    if (!token) return;

    setLoadingCalendar(true);
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    try {
      const res = await fetch(`/api/tasks/calendar?from=${from}&to=${to}`, {
        ...authFetchOptions(token, signal),
      });
      if (signal?.aborted) return;
      if (res.ok) {
        const json = (await res.json()) as { data: { days: CalendarDay[] } };
        if (signal?.aborted) return;
        setCalendarDays(json.data.days);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) setLoadingCalendar(false);
    }
  }, []);

  // Buscar tarefas diarias, perfil e character
  const fetchData = useCallback(async (signal: AbortSignal) => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const opts = authFetchOptions(token, signal);

    try {
      const [tasksRes, profileRes, characterRes] =
        await Promise.all([
          fetch("/api/tasks/daily", opts),
          fetch("/api/user/profile", opts),
          fetch("/api/character", opts),
        ]);

      if (signal.aborted) return;

      if (
        tasksRes.status === 401 ||
        profileRes.status === 401 ||
        characterRes.status === 401
      ) {
        clearAuthAndRedirect(router);
        return;
      }

      if (tasksRes.ok) {
        const tasksJson = (await tasksRes.json()) as {
          data: { tasks: DailyTask[]; summary: { total: number; completed: number } };
        };

        if (signal.aborted) return;

        if (tasksJson.data.tasks.length === 0) {
          const genRes = await fetch("/api/tasks/generate", {
            method: "POST",
            ...authFetchOptions(token, signal),
          });
          if (signal.aborted) return;
          if (genRes.ok || genRes.status === 409) {
            const retryRes = await fetch("/api/tasks/daily", authFetchOptions(token, signal));
            if (signal.aborted) return;
            if (retryRes.ok) {
              const retryJson = (await retryRes.json()) as {
                data: { tasks: DailyTask[]; summary: { total: number; completed: number } };
              };
              if (signal.aborted) return;
              setTasks(retryJson.data.tasks);
            }
          }
        } else {
          setTasks(tasksJson.data.tasks);
        }
      }

      if (signal.aborted) return;

      // Extract player name, avatar, house from profile
      if (profileRes.ok) {
        const profileJson = (await profileRes.json()) as {
          data: { name: string; avatarUrl: string | null; house: { name: string } | null; character: Character | null };
        };
        if (signal.aborted) return;
        setPlayerName(profileJson.data.name);
        setAvatarUrl(profileJson.data.avatarUrl);
        setHouseName(profileJson.data.house?.name ?? null);
        // Fallback character data from profile if character endpoint fails
        if (!characterRes.ok && profileJson.data.character) {
          setCharacter(profileJson.data.character);
        }
      }

      if (characterRes.ok) {
        const charData = (await characterRes.json()) as {
          data: { character: Character; skills: CharacterSkillSlot[] };
        };
        if (signal.aborted) return;
        setCharacter(charData.data.character);
        setSkills(charData.data.skills);
      }

      // Non-blocking boss eligibility check
      fetch("/api/battle/coop/eligible", authFetchOptions(token, signal))
        .then(async (eligibleRes) => {
          if (signal.aborted || !eligibleRes.ok) return;
          const eligibleData = (await eligibleRes.json()) as {
            data:
              | { eligible: true; dominantCategory: string; categoryBreakdown: Record<string, number> }
              | { eligible: false; reason: string; completedCount?: number; totalCount?: number };
          };
          if (signal.aborted) return;
          if (eligibleData.data.eligible) {
            setBossEligible(true);
            setBossDominantCategory(eligibleData.data.dominantCategory);
          } else if (
            "reason" in eligibleData.data &&
            eligibleData.data.reason === "already_participated"
          ) {
            setBossAlreadyParticipated(true);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
        });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      if (!signal.aborted) setLoadingTasks(false);
    }
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    const now = new Date();
    fetchCalendar(now.getFullYear(), now.getMonth(), controller.signal);

    return () => {
      controller.abort();
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [fetchData, fetchCalendar]);

  // Completar tarefa
  async function handleComplete(taskId: string) {
    if (completingId !== null) return;

    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    setCompletingId(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        ...authFetchOptions(token),
      });

      if (res.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (!res.ok) {
        setCompletingId(null);
        return;
      }

      const json = (await res.json()) as CompleteTaskResponse;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completed: true, completedAt: json.data.task.completedAt }
            : t,
        ),
      );

      setCharacter(json.data.character);

      const gainedKeys = new Set<string>();
      const gained = json.data.attributesGained;

      for (const meta of ATTRIBUTE_META) {
        const val = gained[meta.grantKey as keyof typeof gained];
        if (val !== undefined && (val as number) > 0) {
          gainedKeys.add(meta.key);
        }
      }

      setHighlightedKeys(gainedKeys);

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }

      highlightTimerRef.current = setTimeout(() => {
        setHighlightedKeys(new Set());
        highlightTimerRef.current = null;
      }, 1500);
    } catch {
      // Erro de rede silencioso
    } finally {
      setCompletingId(null);
    }
  }

  const handleCalendarMonthChange = useCallback(
    (year: number, month: number, signal: AbortSignal) => {
      fetchCalendar(year, month, signal);
    },
    [fetchCalendar],
  );

  const completedCount = tasks.filter((t) => t.completed).length;
  const streak = calendarDays.filter((d) => d.total > 0 && d.completed === d.total).length;

  return (
    <div className="relative">
      {/* Ember particles */}
      <EmberField />

      {/* Ambient backdrop gradients */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 15% 8%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0, transparent 55%),
            radial-gradient(ellipse at 88% 92%, color-mix(in srgb, var(--deep) 40%, transparent) 0, transparent 55%)`,
        }}
      />

      <div className="relative z-[2] flex flex-col gap-[18px]">
        {/* Player Header */}
        <PlayerHeader character={character} playerName={playerName} avatarUrl={avatarUrl} houseName={houseName} />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 items-start gap-[18px] min-[960px]:grid-cols-[340px_1fr]">

          {/* Sidebar */}
          <aside className="flex flex-col gap-[18px]">
            {loadingTasks ? (
              <Panel title="Progresso Diario">
                <div className="flex items-center justify-center py-12">
                  <div
                    className="h-[120px] w-[120px] animate-pulse rounded-full"
                    style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)" }}
                  />
                </div>
              </Panel>
            ) : (
              <DailyProgressArc
                done={completedCount}
                total={tasks.length}
                streak={streak}
              />
            )}

            <AttributePanel
              character={character}
              highlightedKeys={highlightedKeys}
            />

            <BattleActions
              eligible={bossEligible}
              alreadyParticipated={bossAlreadyParticipated}
              dominantCategory={bossDominantCategory}
              inQueue={inQueue}
              onJoin={joinQueue}
            />
          </aside>

          {/* Main content */}
          <main className="flex flex-col gap-[18px]">
            <EquippedSkillsPreview skills={skills} loading={loadingTasks} />

            {/* Tasks */}
            <Panel
              title="Tarefas do Dia"
              right={loadingTasks ? "" : `${completedCount} de ${tasks.length} cumpridas`}
            >
              {loadingTasks ? (
                <TaskListSkeleton />
              ) : tasks.length === 0 ? (
                <div
                  className="py-8 text-center text-sm italic"
                  style={{
                    fontFamily: "var(--font-garamond)",
                    color: "color-mix(in srgb, var(--gold) 53%, transparent)",
                  }}
                >
                  Nenhuma tarefa para hoje. Selecione habitos no seu perfil para comecar.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      completing={completingId === task.id}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <ActivityCalendar
              days={calendarDays}
              loading={loadingCalendar}
              onMonthChange={handleCalendarMonthChange}
            />
          </main>
        </div>

        {/* Footer motto */}
        <footer
          className="mt-2 text-center text-xs italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 40%, transparent)",
          }}
        >
          &laquo; {houseName && HOUSE_LORE[houseName]
          ? HOUSE_LORE[houseName].motto
          : "O conhecimento e a chave, a disciplina e o caminho"} &raquo;
        </footer>
      </div>
    </div>
  );
}
