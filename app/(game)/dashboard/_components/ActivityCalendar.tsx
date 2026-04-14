"use client";

import { useState, useRef, useEffect } from "react";
import type { CalendarDay } from "@/types/task";

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

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

export default function ActivityCalendar({
  days,
  loading,
  onMonthChange,
}: {
  days: CalendarDay[];
  loading: boolean;
  onMonthChange: (year: number, month: number, signal: AbortSignal) => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const abortRef = useRef<AbortController | null>(null);

  // Cancelar fetch pendente ao desmontar
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const grid = buildMonthGrid(viewYear, viewMonth);

  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  function changeMonth(newYear: number, newMonth: number) {
    // Cancela fetch anterior antes de iniciar novo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setViewMonth(newMonth);
    setViewYear(newYear);
    onMonthChange(newYear, newMonth, controller.signal);
  }

  function goToPrevMonth() {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    changeMonth(newYear, newMonth);
  }

  function goToNextMonth() {
    if (isCurrentMonth) return;
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    changeMonth(newYear, newMonth);
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
