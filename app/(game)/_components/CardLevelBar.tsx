"use client";

import type { CardRarity } from "@/types/cards";
import { getXpProgress, getDuplicateCount } from "@/lib/cards/level";

type Size = "sm" | "md";

type Props = {
  xp: number;
  level: number;
  rarity: CardRarity;
  size?: Size;
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

const HEIGHT_BY_SIZE: Record<Size, number> = {
  sm: 3,
  md: 4,
};

export default function CardLevelBar({ xp, level, rarity, size = "sm" }: Props) {
  const safeXp = Number.isFinite(xp) && xp >= 0 ? xp : 0;
  const safeLevel = Number.isFinite(level) && level >= 1 ? level : 1;
  const progress = getXpProgress(safeXp, safeLevel);
  const heightPx = HEIGHT_BY_SIZE[size];
  const rarityClass = RARITY_CLASS[rarity];

  const fillWidth = `${Math.round(progress.ratio * 1000) / 10}%`;
  const duplicateCount = progress.isMax ? getDuplicateCount(safeXp, rarity) : 0;
  const displayLevel = Math.min(5, Math.max(1, Math.floor(safeLevel)));

  const label = progress.isMax
    ? `MAX · ${duplicateCount} duplicata${duplicateCount === 1 ? "" : "s"}`
    : `Lv ${displayLevel} · ${progress.current}/${progress.needed} XP`;

  return (
    <div className={`flex w-full flex-col gap-0.5 ${rarityClass}`}>
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: `${heightPx}px`,
          background: "color-mix(in srgb, var(--rarity-color) 15%, transparent)",
          boxShadow: progress.isMax ? "0 0 6px var(--rarity-glow)" : undefined,
        }}
      >
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: fillWidth,
            background: "var(--rarity-color)",
          }}
        />
      </div>
      <span
        className="leading-none tracking-[0.05em]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "color-mix(in srgb, var(--gold) 70%, transparent)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
