"use client";

import type { ReactNode } from "react";
import type { RankingSeason } from "@/types/ranking";

type Props = {
  active: RankingSeason;
  onChange: (season: RankingSeason) => void;
};

const SEASONS: ReadonlyArray<{ id: RankingSeason; label: string }> = [
  { id: "lifetime", label: "Lifetime" },
  { id: "monthly", label: "Mensal (30d)" },
  { id: "weekly", label: "Semanal (7d)" },
];

export default function SeasonToggle({ active, onChange }: Props): ReactNode {
  return (
    <div
      className="inline-flex items-center gap-1.5"
      role="tablist"
      aria-label="Periodo do Estandarte"
    >
      {SEASONS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(s.id)}
            className="cursor-pointer px-3 py-1.5 text-[9px] uppercase tracking-[0.25em] transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: isActive
                ? "var(--gold)"
                : "color-mix(in srgb, var(--gold) 50%, transparent)",
              border: `1px solid color-mix(in srgb, var(--gold) ${
                isActive ? "55%" : "18%"
              }, transparent)`,
              background: isActive
                ? "color-mix(in srgb, var(--gold) 8%, transparent)"
                : "transparent",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
