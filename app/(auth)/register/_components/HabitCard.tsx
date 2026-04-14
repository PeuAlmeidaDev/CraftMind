import type { Habit, HabitCategory } from "@/types";

const CATEGORY_BG: Record<HabitCategory, string> = {
  PHYSICAL: "bg-red-500",
  INTELLECTUAL: "bg-blue-500",
  MENTAL: "bg-violet-500",
  SOCIAL: "bg-amber-500",
  SPIRITUAL: "bg-emerald-500",
};

/** Card de habito com checkbox visual para selecao no cadastro */
export function HabitCard({
  habit,
  selected,
  onToggle,
}: {
  habit: Habit;
  selected: boolean;
  onToggle: () => void;
}) {
  const dotColor = CATEGORY_BG[habit.category];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative w-full rounded-lg border p-3 text-left transition-all duration-200 ${
        selected
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-gray-600 hover:brightness-110"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-200 ${
            selected
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
              : "border-gray-600 bg-transparent"
          }`}
        >
          {selected && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200">{habit.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{habit.description}</p>
        </div>
      </div>
      <div
        className={`absolute right-2 top-2 h-2 w-2 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
    </button>
  );
}
