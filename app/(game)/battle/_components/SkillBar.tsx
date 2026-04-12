"use client";

import type { AvailableSkill } from "../page";

type SkillBarProps = {
  skills: AvailableSkill[];
  onSkillUse: (skillId: string) => void;
  onSkipTurn: () => void;
  disabled: boolean;
};

const DAMAGE_TYPE_LABEL: Record<string, { text: string; color: string }> = {
  PHYSICAL: { text: "Fisico", color: "text-red-400" },
  MAGICAL: { text: "Magico", color: "text-blue-400" },
  NONE: { text: "Suporte", color: "text-emerald-400" },
};

function playSfx(skillName: string) {
  const slug = skillName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const audio = new Audio(`/sfx/${slug}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

export default function SkillBar({
  skills,
  onSkillUse,
  onSkipTurn,
  disabled,
}: SkillBarProps) {
  const slots = Array.from({ length: 4 }, (_, i) => {
    return skills.find((s) => s.slotIndex === i) ?? null;
  });

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
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
          const isDisabled = disabled || inCooldown;
          const dmgType = DAMAGE_TYPE_LABEL[skill.damageType] ?? {
            text: skill.damageType,
            color: "text-gray-400",
          };

          return (
            <button
              key={skill.skillId}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                playSfx(skill.name);
                onSkillUse(skill.skillId);
              }}
              className={`relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-3 text-left transition-colors ${
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
        disabled={disabled}
        onClick={onSkipTurn}
        className={`mt-2 w-full py-2 text-xs text-gray-500 transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:text-gray-300 cursor-pointer"
        }`}
      >
        Pular turno
      </button>
    </div>
  );
}
