"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { expToNextLevel } from "@/lib/exp/formulas";
import type { DailyTask, CompleteTaskResponse } from "@/types/task";
import type { Character } from "@/types/character";
import type { HabitCategory } from "@/types/habit";
import type { CharacterSkillSlot } from "@/types/skill";
import type { CalendarDay } from "@/types/task";
import { useBossQueue } from "../_hooks/useBossQueue";

// ---------------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<HabitCategory, string> = {
  PHYSICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  INTELLECTUAL: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  MENTAL: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  SOCIAL: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SPIRITUAL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const CATEGORY_LABEL: Record<HabitCategory, string> = {
  PHYSICAL: "Fisico",
  INTELLECTUAL: "Intelectual",
  MENTAL: "Mental",
  SOCIAL: "Social",
  SPIRITUAL: "Espiritual",
};

const ATTRIBUTE_META: {
  key: keyof Character;
  grantKey: string;
  label: string;
  icon: string;
}[] = [
  { key: "physicalAtk", grantKey: "physicalAttack", label: "Ataque Fisico", icon: "\u2694\uFE0F" },
  { key: "physicalDef", grantKey: "physicalDefense", label: "Defesa Fisica", icon: "\u{1F6E1}\uFE0F" },
  { key: "magicAtk", grantKey: "magicAttack", label: "Ataque Magico", icon: "\u2728" },
  { key: "magicDef", grantKey: "magicDefense", label: "Defesa Magica", icon: "\u{1F52E}" },
  { key: "hp", grantKey: "hp", label: "Vida", icon: "\u2764\uFE0F" },
  { key: "speed", grantKey: "speed", label: "Velocidade", icon: "\u{1F4A8}" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

function clearAuthAndRedirect(router: ReturnType<typeof useRouter>) {
  localStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; max-age=0; samesite=strict";
  router.push("/login");
}

// ---------------------------------------------------------------------------
// Componentes internos
// ---------------------------------------------------------------------------

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-200">Progresso do dia</span>
        <span className="text-gray-400">
          {completed} de {total} tarefas
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AttributePanel({
  character,
  highlightedKeys,
}: {
  character: Character | null;
  highlightedKeys: Set<string>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Atributos
      </h2>

      {character === null ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-28 animate-pulse rounded bg-[var(--border-subtle)]" />
              <div className="h-4 w-8 animate-pulse rounded bg-[var(--border-subtle)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ATTRIBUTE_META.map(({ key, label, icon }) => {
            const highlighted = highlightedKeys.has(key);
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors duration-700 ${
                  highlighted
                    ? "bg-[var(--accent-primary)]/15"
                    : ""
                }`}
              >
                <span className="text-sm text-gray-300">
                  {icon} {label}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums transition-colors duration-700 ${
                    highlighted ? "text-[var(--accent-primary)]" : "text-white"
                  }`}
                >
                  {character[key]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  const categoryColor =
    CATEGORY_COLORS[task.habitCategory as HabitCategory] ??
    "bg-gray-500/15 text-gray-400 border-gray-500/30";

  const grants = task.attributeGrants;
  const grantEntries = ATTRIBUTE_META.filter(
    ({ grantKey }) =>
      grants[grantKey as keyof typeof grants] !== undefined &&
      (grants[grantKey as keyof typeof grants] as number) > 0
  );

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        task.completed
          ? "border-emerald-500/30 bg-emerald-900/20 opacity-70"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
      }`}
    >
      {/* Header: badge + status */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${categoryColor}`}
        >
          {task.habitName}
        </span>
        <span
          className={`text-xs ${categoryColor.split(" ")[1] ?? "text-gray-400"}`}
        >
          {CATEGORY_LABEL[task.habitCategory as HabitCategory] ?? task.habitCategory}
        </span>
      </div>

      {/* Descricao */}
      <p className="mb-3 text-sm leading-relaxed text-gray-200">
        {task.completed && (
          <span className="mr-1.5 text-emerald-400">{"\u2713"}</span>
        )}
        {task.description}
      </p>

      {/* Preview de atributos */}
      {grantEntries.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {grantEntries.map(({ grantKey, icon }) => (
            <span
              key={grantKey}
              className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-xs text-gray-400"
            >
              {icon} +{grants[grantKey as keyof typeof grants]}
            </span>
          ))}
        </div>
      )}

      {/* Botao ou status completada */}
      {task.completed ? (
        <span className="text-xs font-medium text-emerald-400">Completada</span>
      ) : (
        <button
          onClick={() => onComplete(task.id)}
          disabled={completing}
          className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {completing ? "Completando..." : "Completar"}
        </button>
      )}
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
        >
          <div className="mb-3 flex gap-2">
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--border-subtle)]" />
            <div className="h-5 w-16 animate-pulse rounded bg-[var(--border-subtle)]" />
          </div>
          <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-[var(--border-subtle)]" />
          <div className="flex gap-1.5">
            <div className="h-5 w-14 animate-pulse rounded bg-[var(--border-subtle)]" />
            <div className="h-5 w-14 animate-pulse rounded bg-[var(--border-subtle)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(date);
  }

  return cells;
}

function LevelExpBar({ character }: { character: Character | null }) {
  if (character === null) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--border-subtle)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-[var(--border-subtle)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--border-subtle)]" />
          </div>
          <div className="h-6 w-28 animate-pulse rounded bg-[var(--border-subtle)]" />
        </div>
      </div>
    );
  }

  const needed = expToNextLevel(character.level);
  const pct = needed === 0 ? 100 : Math.min(100, Math.round((character.currentExp / needed) * 100));

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-4">
        {/* Badge de nivel */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] font-bold text-white">
          {character.level}
        </div>

        {/* Barra de EXP */}
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {character.currentExp} / {needed} EXP
          </p>
        </div>

        {/* Pontos livres */}
        {character.freePoints > 0 && (
          <Link
            href="/character"
            className="shrink-0 rounded-lg bg-[var(--accent-primary)]/20 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/30"
          >
            {character.freePoints} pontos livres
          </Link>
        )}
      </div>
    </div>
  );
}

function EquippedSkillsPreview({
  skills,
  loading,
}: {
  skills: CharacterSkillSlot[];
  loading: boolean;
}) {
  const TIER_COLORS: Record<number, string> = {
    1: "text-gray-400 bg-gray-500/15",
    2: "text-blue-400 bg-blue-500/15",
    3: "text-purple-400 bg-purple-500/15",
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Habilidades
      </h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-[var(--border-subtle)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, idx) => {
            const slot = skills.find((s) => s.slotIndex === idx);

            if (!slot) {
              return (
                <div
                  key={idx}
                  className="flex h-16 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)]"
                >
                  <span className="text-xs text-gray-600">Vazio</span>
                </div>
              );
            }

            const tierColor = TIER_COLORS[slot.skill.tier] ?? TIER_COLORS[1];

            return (
              <div
                key={idx}
                className="flex flex-col justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-2"
              >
                <span className="truncate text-xs font-medium text-gray-200">
                  {slot.skill.name}
                </span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-semibold ${tierColor}`}
                  >
                    T{slot.skill.tier}
                  </span>
                  {slot.skill.cooldown > 0 && (
                    <span className="text-[10px] text-gray-500">
                      CD: {slot.skill.cooldown}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/character"
        className="mt-3 block text-center text-xs text-gray-400 transition-colors hover:text-[var(--accent-primary)]"
      >
        Gerenciar
      </Link>
    </div>
  );
}

function PveBattleButton() {
  return (
    <Link
      href="/battle"
      className="block w-full rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 py-3 text-center font-semibold text-white transition hover:brightness-110"
    >
      {"\u2694\uFE0F"} Batalhar
    </Link>
  );
}

function BossFightCard({
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
  if (alreadyParticipated) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center">
        <p className="text-sm font-medium text-gray-500">
          Ja participou de um Boss Fight hoje
        </p>
      </div>
    );
  }

  if (!eligible) return null;

  if (inQueue) {
    return (
      <div className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--bg-card)] p-4 text-center">
        <p className="text-sm font-medium text-[var(--accent-primary)]">
          Na fila...
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-purple-500/40 p-4"
      style={{
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.08))",
      }}
    >
      <p className="text-sm font-bold text-purple-300">Boss Fight Disponivel!</p>
      <p className="mt-1 text-xs text-gray-400">
        Enfrente um boss com outros jogadores
      </p>
      <button
        type="button"
        onClick={() => {
          if (dominantCategory) onJoin(dominantCategory);
        }}
        className="mt-3 w-full cursor-pointer rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 py-2 text-xs font-semibold text-white transition hover:brightness-110"
      >
        Entrar na Fila
      </button>
    </div>
  );
}

function ActivityCalendar({
  days,
  loading,
  onMonthChange,
}: {
  days: CalendarDay[];
  loading: boolean;
  onMonthChange: (year: number, month: number) => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const grid = buildMonthGrid(viewYear, viewMonth);
  const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  function goToPrevMonth() {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    onMonthChange(newYear, newMonth);
  }

  function goToNextMonth() {
    if (isCurrentMonth) return;
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
    onMonthChange(newYear, newMonth);
  }

  function getCellColor(dateStr: string): string {
    const day = days.find((d) => d.date === dateStr);
    if (!day || day.total === 0 || day.completed === 0)
      return "bg-[var(--border-subtle)]";
    const ratio = day.completed / day.total;
    if (ratio < 0.4) return "bg-emerald-900/60";
    if (ratio < 0.8) return "bg-emerald-600/70";
    return "bg-emerald-400";
  }

  function getCellTitle(dateStr: string): string {
    const day = days.find((d) => d.date === dateStr);
    const dayNum = parseInt(dateStr.slice(8, 10), 10);
    const monthIdx = parseInt(dateStr.slice(5, 7), 10) - 1;
    const label = `${dayNum} ${MONTH_ABBR[monthIdx]}`;
    if (!day || day.total === 0) return `${label}: sem tarefas`;
    return `${label}: ${day.completed}/${day.total} tarefas`;
  }

  const todayStr = now.toISOString().slice(0, 10);

  // Rows needed: ceil cells to fill complete weeks
  const totalRows = Math.ceil(grid.length / 7);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      {/* Cabecalho de navegacao */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm text-gray-400 transition-colors hover:bg-[var(--bg-secondary)] hover:text-white"
        >
          {"\u2039"}
        </button>
        <span className="text-sm font-medium text-gray-200">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm text-gray-400 transition-colors hover:bg-[var(--bg-secondary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {"\u203A"}
        </button>
      </div>

      {/* Labels dos dias da semana */}
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, i) => (
          <span key={i} className="text-center text-[11px] font-medium text-zinc-500">
            {label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-[var(--border-subtle)]"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Grid do calendario */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: totalRows * 7 }).map((_, i) => {
              const dateStr = grid[i] ?? null;

              if (!dateStr) {
                return <div key={i} />;
              }

              const dayNum = parseInt(dateStr.slice(8, 10), 10);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={i}
                  className={`group relative flex aspect-square cursor-pointer items-center justify-center rounded-lg text-xs transition-colors hover:brightness-125 ${getCellColor(dateStr)} ${
                    isToday
                      ? "ring-2 ring-[var(--accent-primary)]"
                      : ""
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "font-bold text-white"
                        : "text-gray-400"
                    }
                  >
                    {dayNum}
                  </span>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 whitespace-nowrap">
                    {getCellTitle(dateStr)}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[var(--bg-secondary)]" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-500">
            <span>Menos</span>
            <div className="h-3 w-3 rounded-sm bg-[var(--border-subtle)]" />
            <div className="h-3 w-3 rounded-sm bg-emerald-900/60" />
            <div className="h-3 w-3 rounded-sm bg-emerald-600/70" />
            <div className="h-3 w-3 rounded-sm bg-emerald-400" />
            <span>Mais</span>
          </div>
        </>
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

  const { joinQueue, inQueue } = useBossQueue();

  // Buscar calendario por mes
  const fetchCalendar = useCallback(async (year: number, month: number) => {
    const token = getToken();
    if (!token) return;

    setLoadingCalendar(true);
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    try {
      const res = await fetch(`/api/tasks/calendar?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { days: CalendarDay[] } };
        setCalendarDays(json.data.days);
      }
    } catch {
      // silencioso
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  // Buscar tarefas diarias, perfil e character
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [tasksRes, profileRes, characterRes] =
        await Promise.all([
          fetch("/api/tasks/daily", { headers }),
          fetch("/api/user/profile", { headers }),
          fetch("/api/character", { headers }),
        ]);

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

        if (tasksJson.data.tasks.length === 0) {
          const genRes = await fetch("/api/tasks/generate", {
            method: "POST",
            headers,
          });
          if (genRes.ok || genRes.status === 409) {
            const retryRes = await fetch("/api/tasks/daily", { headers });
            if (retryRes.ok) {
              const retryJson = (await retryRes.json()) as {
                data: { tasks: DailyTask[]; summary: { total: number; completed: number } };
              };
              setTasks(retryJson.data.tasks);
            }
          }
        } else {
          setTasks(tasksJson.data.tasks);
        }
      }

      if (characterRes.ok) {
        const charData = (await characterRes.json()) as {
          data: { character: Character; skills: CharacterSkillSlot[] };
        };
        setCharacter(charData.data.character);
        setSkills(charData.data.skills);
      } else if (profileRes.ok) {
        const profileJson = (await profileRes.json()) as {
          data: { character: Character | null };
        };
        setCharacter(profileJson.data.character);
      }

      // Non-blocking boss eligibility check
      fetch("/api/battle/coop/eligible", { headers })
        .then(async (eligibleRes) => {
          if (!eligibleRes.ok) return;
          const eligibleData = (await eligibleRes.json()) as {
            data:
              | { eligible: true; dominantCategory: string; categoryBreakdown: Record<string, number> }
              | { eligible: false; reason: string; completedCount?: number; totalCount?: number };
          };
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
        .catch(() => {
          // Boss eligibility check failed silently
        });
    } catch {
      // Erro de rede silencioso
    } finally {
      setLoadingTasks(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
    const now = new Date();
    fetchCalendar(now.getFullYear(), now.getMonth());
  }, [fetchData, fetchCalendar]);

  // Completar tarefa
  async function handleComplete(taskId: string) {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    setCompletingId(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

      // Atualizar tarefa na lista
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completed: true, completedAt: json.data.task.completedAt }
            : t
        )
      );

      // Atualizar atributos do personagem
      setCharacter(json.data.character);

      // Destacar atributos que mudaram
      const gainedKeys = new Set<string>();
      const gained = json.data.attributesGained;

      for (const meta of ATTRIBUTE_META) {
        const val = gained[meta.grantKey as keyof typeof gained];
        if (val !== undefined && (val as number) > 0) {
          gainedKeys.add(meta.key);
        }
      }

      setHighlightedKeys(gainedKeys);

      // Remover highlight apos 1.5s
      setTimeout(() => {
        setHighlightedKeys(new Set());
      }, 1500);
    } catch {
      // Erro de rede silencioso
    } finally {
      setCompletingId(null);
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Barra de nivel e EXP */}
      <LevelExpBar character={character} />

      {/* Barra de progresso */}
      {loadingTasks ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="mb-2 flex justify-between">
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--border-subtle)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--border-subtle)]" />
          </div>
          <div className="h-3 animate-pulse rounded-full bg-[var(--border-subtle)]" />
        </div>
      ) : (
        <ProgressBar completed={completedCount} total={tasks.length} />
      )}

      {/* Grid: sidebar + tarefas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <AttributePanel
            character={character}
            highlightedKeys={highlightedKeys}
          />
          <EquippedSkillsPreview skills={skills} loading={loadingTasks} />
          <PveBattleButton />
          <BossFightCard
            eligible={bossEligible}
            alreadyParticipated={bossAlreadyParticipated}
            dominantCategory={bossDominantCategory}
            inQueue={inQueue}
            onJoin={joinQueue}
          />
          <ActivityCalendar
            days={calendarDays}
            loading={loadingCalendar}
            onMonthChange={fetchCalendar}
          />
        </div>

        {/* Tarefas */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Tarefas Diarias
          </h2>

          {loadingTasks ? (
            <TaskListSkeleton />
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
              <p className="text-sm text-gray-400">
                Nenhuma tarefa para hoje. Selecione habitos no seu perfil para comecar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
        </div>
      </div>
    </div>
  );
}
