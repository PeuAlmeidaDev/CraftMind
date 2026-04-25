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
      className={`group relative w-full border p-3 text-left transition-all duration-200 ${
        selected
          ? "hover:brightness-110"
          : "hover:brightness-110"
      }`}
      style={
        selected
          ? {
              borderColor: "var(--accent-primary)",
              backgroundColor: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
            }
          : {
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-card)",
            }
      }
    >
      <div className="flex items-start gap-2.5">
        <div
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center transition-all duration-200"
          style={
            selected
              ? {
                  border: "1px solid var(--ember)",
                  backgroundColor: "var(--ember)",
                }
              : {
                  border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
                  backgroundColor: "transparent",
                }
          }
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
          <p
            className="text-sm font-medium"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 85%, transparent)",
            }}
          >
            {habit.name}
          </p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--gold) 40%, transparent)" }}
          >
            {habit.description}
          </p>
        </div>
      </div>
      <div
        className={`absolute right-2 top-2 h-1.5 w-1.5 ${dotColor}`}
        aria-hidden="true"
      />
    </button>
  );
}
