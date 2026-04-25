"use client";

import { useState, useRef, useEffect } from "react";
import type { CalendarDay } from "@/types/task";
import Panel from "@/components/ui/Panel";

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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const grid = buildMonthGrid(viewYear, viewMonth);

  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  function changeMonth(newYear: number, newMonth: number) {
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

  function getCellValue(dateStr: string): number | null {
    const day = days.find((d) => d.date === dateStr);
    if (!day || day.total === 0) return null;
    return day.completed / day.total;
  }

  function getCellTitle(dateStr: string): string {
    const day = days.find((d) => d.date === dateStr);
    const dayNum = parseInt(dateStr.slice(8, 10), 10);
    if (!day || day.total === 0) return `${dayNum}: sem tarefas`;
    return `${dayNum}: ${day.completed}/${day.total} tarefas`;
  }

  const todayStr = now.toISOString().slice(0, 10);
  const totalRows = Math.ceil(grid.length / 7);

  // Streak from days data
  const streak = days.filter(d => d.total > 0 && d.completed === d.total).length;

  return (
    <Panel
      title={`Vigilia · ${MONTH_NAMES[viewMonth]}`}
      right={`${streak} dias em chama`}
    >
      {/* Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="flex h-6 w-6 cursor-pointer items-center justify-center text-sm transition-colors hover:text-white"
          style={{
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            fontFamily: "var(--font-garamond)",
          }}
        >
          {"\u2039"}
        </button>
        <span
          className="text-[10px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          }}
        >
          {viewYear}
        </span>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="flex h-6 w-6 cursor-pointer items-center justify-center text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          style={{
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            fontFamily: "var(--font-garamond)",
          }}
        >
          {"\u203A"}
        </button>
      </div>

      {/* Weekday labels */}
      <div
        className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[8px] tracking-[0.15em]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "color-mix(in srgb, var(--gold) 40%, transparent)",
        }}
      >
        {DAY_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse"
              style={{ background: "color-mix(in srgb, var(--gold) 4%, transparent)" }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: totalRows * 7 }).map((_, i) => {
              const dateStr = grid[i] ?? null;

              if (!dateStr) {
                return <div key={i} className="aspect-square" />;
              }

              const dayNum = parseInt(dateStr.slice(8, 10), 10);
              const isToday = dateStr === todayStr;
              const value = getCellValue(dateStr);

              // Color based on completion value
              let bgColor: string;
              let textColor: string;
              if (value === null) {
                bgColor = "color-mix(in srgb, var(--gold) 4%, transparent)";
                textColor = "color-mix(in srgb, var(--gold) 27%, transparent)";
              } else if (value === 0) {
                bgColor = "color-mix(in srgb, var(--gold) 9%, transparent)";
                textColor = "color-mix(in srgb, var(--gold) 40%, transparent)";
              } else {
                const alpha = Math.round(30 + value * 210)
                  .toString(16)
                  .padStart(2, "0");
                bgColor = `var(--ember)${alpha}`;
                textColor = value > 0.5 ? "#fff" : "color-mix(in srgb, var(--gold) 60%, transparent)";
              }

              return (
                <div
                  key={i}
                  title={getCellTitle(dateStr)}
                  className="flex aspect-square cursor-default items-center justify-center text-[8px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: bgColor,
                    border: `1px solid color-mix(in srgb, var(--gold) ${value === null ? "7%" : "14%"}, transparent)`,
                    color: textColor,
                    outline: isToday ? "1px solid var(--accent-primary)" : "none",
                    outlineOffset: -1,
                  }}
                >
                  {dayNum}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            className="mt-3 flex items-center justify-center gap-1.5 text-[8px] tracking-[0.2em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "color-mix(in srgb, var(--gold) 53%, transparent)",
            }}
          >
            <span>MENOS</span>
            {[0, 0.25, 0.5, 0.75, 1].map((v, j) => {
              const alpha = Math.round(30 + v * 210)
                .toString(16)
                .padStart(2, "0");
              return (
                <div
                  key={j}
                  className="h-3 w-3"
                  style={{
                    background: v === 0
                      ? "color-mix(in srgb, var(--gold) 9%, transparent)"
                      : `var(--ember)${alpha}`,
                    border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                />
              );
            })}
            <span>MAIS</span>
          </div>
        </>
      )}
    </Panel>
  );
}
