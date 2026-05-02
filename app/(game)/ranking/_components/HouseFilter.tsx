"use client";

import type { ReactNode } from "react";
import type { HouseFilter } from "@/types/ranking";
import {
  HOUSE_BADGE_COLORS,
  HOUSE_DISPLAY,
} from "./house-colors";

type Props = {
  active: HouseFilter;
  onChange: (filter: HouseFilter) => void;
};

const FILTERS: ReadonlyArray<{ id: HouseFilter; label: string }> = [
  { id: "GLOBAL", label: "Global" },
  { id: "ARION", label: HOUSE_DISPLAY.ARION },
  { id: "LYCUS", label: HOUSE_DISPLAY.LYCUS },
  { id: "NOCTIS", label: HOUSE_DISPLAY.NOCTIS },
  { id: "NEREID", label: HOUSE_DISPLAY.NEREID },
];

export default function HouseFilterTabs({ active, onChange }: Props): ReactNode {
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 sm:gap-2"
      aria-label="Filtro por casa"
    >
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        const accent =
          f.id === "GLOBAL"
            ? "var(--gold)"
            : HOUSE_BADGE_COLORS[f.id];

        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className="cursor-pointer px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: isActive ? accent : "color-mix(in srgb, var(--gold) 50%, transparent)",
              border: `1px solid color-mix(in srgb, ${accent} ${
                isActive ? "60%" : "20%"
              }, transparent)`,
              background: isActive
                ? `color-mix(in srgb, ${accent} 8%, transparent)`
                : "transparent",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </nav>
  );
}
