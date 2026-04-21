"use client";

import type { AvailableSkill } from "../page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MultiSkillBarProps = {
  skills: AvailableSkill[];
  onSkillSelect: (skillId: string, target: string) => void;
  onSkipTurn: () => void;
  disabled: boolean;
  targetingMode: boolean;
  pendingSkillId: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAMAGE_TYPE_LABEL: Record<string, { text: string; color: string }> = {
  PHYSICAL: { text: "Fisico", color: "text-red-400" },
  MAGICAL: { text: "Magico", color: "text-blue-400" },
  NONE: { text: "Suporte", color: "text-emerald-400" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MultiSkillBar({
  skills,
  onSkillSelect,
  onSkipTurn,
  disabled,
  targetingMode,
  pendingSkillId,
}: MultiSkillBarProps) {
  const slots = Array.from({ length: 4 }, (_, i) => {
    return skills.find((s) => s.slotIndex === i) ?? null;
  });

  return (
    <div className="relative">
      {/* Targeting overlay message */}
      {targetingMode && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 pointer-events-none">
          <div className="text-center">
            <span className="text-lg">&#127919;</span>
            <p className="text-sm font-medium text-[var(--accent-secondary)] mt-1">
              Selecione um alvo...
            </p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2 ${targetingMode ? "opacity-40" : ""}`}>
        {slots.map((skill, idx) => {
          if (!skill) {
            return (
              <div
                key={`empty-${idx}`}
                className="rounded-lg border border-dashed border-[var(--border-subtle)] p-3 min-h-[72px]"
              />
            );
          }

          const inCooldown = skill.cooldown > 0;
          const isPending = pendingSkillId === skill.skillId;
          const isDisabled = disabled || inCooldown || (targetingMode && !isPending);
          const dmgType = DAMAGE_TYPE_LABEL[skill.damageType] ?? {
            text: skill.damageType,
            color: "text-gray-400",
          };

          return (
            <button
              key={skill.skillId}
              type="button"
              disabled={isDisabled}
              onClick={() => onSkillSelect(skill.skillId, skill.target)}
              className={`relative rounded-lg border p-3 text-left transition-colors ${
                isPending
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 opacity-100"
                  : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60"
              } ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 cursor-pointer"
              }`}
            >
              <span className="block text-sm font-medium truncate">
                {skill.name}
              </span>

              <span className={`block text-[10px] ${dmgType.color}`}>
                {dmgType.text}
              </span>

              {skill.basePower > 0 && (
                <span className="block text-[10px] text-gray-500">
                  Poder: {skill.basePower}
                </span>
              )}

              {skill.target === "SINGLE_ENEMY" && (
                <span className="block text-[10px] text-gray-600">
                  Alvo unico
                </span>
              )}

              {inCooldown && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
                  <span className="text-sm font-semibold text-gray-300">
                    CD: {skill.cooldown}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={disabled || targetingMode}
        onClick={onSkipTurn}
        className={`mt-2 w-full py-2 text-xs text-gray-500 transition-colors ${
          disabled || targetingMode
            ? "opacity-50 cursor-not-allowed"
            : "hover:text-gray-300 cursor-pointer"
        }`}
      >
        Pular turno
      </button>
    </div>
  );
}
