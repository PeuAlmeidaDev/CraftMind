"use client";

import Link from "next/link";
import type { CharacterSkillSlot } from "@/types/skill";

const TIER_COLORS: Record<number, string> = {
  1: "text-gray-400 bg-gray-500/15",
  2: "text-blue-400 bg-blue-500/15",
  3: "text-purple-400 bg-purple-500/15",
};

export default function EquippedSkillsPreview({
  skills,
  loading,
}: {
  skills: CharacterSkillSlot[];
  loading: boolean;
}) {
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
