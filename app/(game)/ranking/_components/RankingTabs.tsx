"use client";

import type { ReactNode } from "react";

export const RANKING_CATEGORIES = [
  { id: "pvp-1v1", label: "PvP 1v1" },
  { id: "pvp-team", label: "PvP Team" },
  { id: "level", label: "Level" },
  { id: "habits", label: "Habitos" },
  { id: "houses", label: "Estandarte" },
] as const;

export type RankingCategory = (typeof RANKING_CATEGORIES)[number]["id"];

type Props = {
  active: RankingCategory;
  onChange: (category: RankingCategory) => void;
};

export default function RankingTabs({ active, onChange }: Props): ReactNode {
  return (
    <nav
      className="flex flex-wrap items-center gap-2 sm:gap-4"
      aria-label="Categorias de ranking"
    >
      {RANKING_CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`cursor-pointer text-[10px] uppercase transition-colors tracking-[0.25em] hover:text-white ${
              isActive
                ? "border-b-2 border-b-[var(--ember)] pb-1 text-white"
                : ""
            }`}
            style={{
              fontFamily: "var(--font-cinzel)",
              ...(isActive
                ? {}
                : {
                    color:
                      "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }),
            }}
          >
            {cat.label}
          </button>
        );
      })}
    </nav>
  );
}
