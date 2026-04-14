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
import ActivityCalendar from "./_components/ActivityCalendar";
import EquippedSkillsPreview from "./_components/EquippedSkillsPreview";

// ---------------------------------------------------------------------------
// Componentes internos (pequenos, acoplados ao dashboard)
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

      if (characterRes.ok) {
        const charData = (await characterRes.json()) as {
          data: { character: Character; skills: CharacterSkillSlot[] };
        };
        if (signal.aborted) return;
        setCharacter(charData.data.character);
        setSkills(charData.data.skills);
      } else if (profileRes.ok) {
        const profileJson = (await profileRes.json()) as {
          data: { character: Character | null };
        };
        if (signal.aborted) return;
        setCharacter(profileJson.data.character);
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
      // Limpar timer do highlight ao desmontar
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [fetchData, fetchCalendar]);

  // Completar tarefa
  async function handleComplete(taskId: string) {
    // Guard contra double-submit: se ja esta completando algo, ignora
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

      // Limpar timer anterior se existir
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }

      // Remover highlight apos 1.5s
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

  // Callback do calendario com AbortSignal vindo do componente
  const handleCalendarMonthChange = useCallback(
    (year: number, month: number, signal: AbortSignal) => {
      fetchCalendar(year, month, signal);
    },
    [fetchCalendar],
  );

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
            onMonthChange={handleCalendarMonthChange}
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
