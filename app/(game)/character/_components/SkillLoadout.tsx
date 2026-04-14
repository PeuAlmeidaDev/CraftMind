"use client";

import type { CharacterSkillSlot } from "@/types/skill";

type Props = {
  equipped: CharacterSkillSlot[];
  onSlotClick: (slotIndex: number) => void;
  onUnequip: (slotIndex: number) => void;
};

const TIER_STYLES: Record<number, string> = {
  1: "text-gray-400 bg-gray-500/15",
  2: "text-blue-400 bg-blue-500/15",
  3: "text-purple-400 bg-purple-500/15",
};

const DAMAGE_TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

const SLOT_INDEXES = [0, 1, 2, 3] as const;

export default function SkillLoadout({ equipped, onSlotClick, onUnequip }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Loadout
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {SLOT_INDEXES.map((idx) => {
          const slot = equipped.find((s) => s.slotIndex === idx);

          if (slot) {
            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => onSlotClick(idx)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSlotClick(idx); } }}
                className="relative min-h-[80px] cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-left hover:brightness-110"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnequip(idx);
                  }}
                  className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center text-gray-500 hover:text-red-400"
                  aria-label={`Remover ${slot.skill.name}`}
                >
                  &times;
                </button>

                <p className="truncate pr-5 text-sm font-medium text-gray-200">
                  {slot.skill.name}
                </p>

                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${TIER_STYLES[slot.skill.tier] ?? TIER_STYLES[1]}`}
                >
                  T{slot.skill.tier}
                </span>

                {slot.skill.cooldown > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    CD: {slot.skill.cooldown}
                  </p>
                )}

                <p className="mt-0.5 text-xs text-gray-500">
                  {DAMAGE_TYPE_LABEL[slot.skill.damageType] ?? slot.skill.damageType}
                </p>
              </div>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSlotClick(idx)}
              className="flex min-h-[80px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] p-3 hover:border-gray-500"
            >
              <span className="text-xs text-gray-500">Escolher skill</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
