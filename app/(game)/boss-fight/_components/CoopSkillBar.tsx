"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoopAvailableSkill = {
  skillId: string;
  slotIndex: number;
  name: string;
  basePower: number;
  damageType: string;
  target: string;
  cooldown: number;
  accuracy: number;
  /** True quando esta skill vem do 5o slot (Cristal Espectral, purity 100). */
  fromSpectralCard?: boolean;
};

type CoopSkillBarProps = {
  skills: CoopAvailableSkill[];
  onSkillUse: (skillId: string, targetId?: string) => void;
  onSkipTurn: () => void;
  disabled: boolean;
  teammates: { playerId: string; name: string; isAlive: boolean }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoopSkillBar({
  skills,
  onSkillUse,
  onSkipTurn,
  disabled,
  teammates,
}: CoopSkillBarProps) {
  const [selectingTargetForSkill, setSelectingTargetForSkill] = useState<string | null>(null);

  // Cancel ally selection on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectingTargetForSkill(null);
    }
  }, []);

  useEffect(() => {
    if (selectingTargetForSkill) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectingTargetForSkill, handleKeyDown]);

  // Cancel selection when disabled changes (new turn, etc.)
  useEffect(() => {
    if (disabled) {
      setSelectingTargetForSkill(null);
    }
  }, [disabled]);

  const handleSkillClick = (skill: CoopAvailableSkill) => {
    playSfx(skill.name);

    if (skill.target === "SINGLE_ALLY") {
      setSelectingTargetForSkill(skill.skillId);
      return;
    }

    // All other targets: fire immediately
    onSkillUse(skill.skillId);
  };

  const handleAllySelect = (targetId: string) => {
    if (!selectingTargetForSkill) return;
    onSkillUse(selectingTargetForSkill, targetId);
    setSelectingTargetForSkill(null);
  };

  const handleCancelSelection = () => {
    setSelectingTargetForSkill(null);
  };

  // Build slots (4 ou 5 quando ha Cristal Espectral equipado)
  const hasSpectral = skills.some((s) => s.fromSpectralCard);
  const totalSlots = hasSpectral ? 5 : 4;
  const slots = Array.from({ length: totalSlots }, (_, i) => {
    return skills.find((s) => s.slotIndex === i) ?? null;
  });

  const aliveTeammates = teammates.filter((t) => t.isAlive);

  return (
    <div>
      {/* Skill grid */}
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
          const isSelectingThis = selectingTargetForSkill === skill.skillId;
          const isSpectral = skill.fromSpectralCard === true;
          const dmgType = DAMAGE_TYPE_LABEL[skill.damageType] ?? {
            text: skill.damageType,
            color: "text-gray-400",
          };

          return (
            <button
              key={skill.skillId}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSkillClick(skill)}
              className={`relative rounded-lg border p-3 text-left transition-colors ${
                isSpectral
                  ? "bg-[var(--bg-secondary)]/60"
                  : isSelectingThis
                  ? "border-amber-400 bg-amber-400/10"
                  : isDisabled
                  ? "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 opacity-50 cursor-not-allowed"
                  : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 cursor-pointer"
              }`}
              style={
                isSpectral
                  ? {
                      borderColor: "var(--gold)",
                      boxShadow:
                        "0 0 8px color-mix(in srgb, var(--gold) 40%, transparent), inset 0 0 4px color-mix(in srgb, var(--gold) 20%, transparent)",
                      opacity: isDisabled ? 0.5 : 1,
                    }
                  : undefined
              }
            >
              {isSpectral && (
                <span
                  className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.3em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "var(--bg-primary)",
                    background: "var(--gold)",
                    border: "1px solid var(--gold)",
                  }}
                >
                  Espectral
                </span>
              )}
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

      {/* SINGLE_ALLY target selection */}
      {selectingTargetForSkill && (
        <div className="mt-2 rounded-lg border border-amber-400/50 bg-[var(--bg-card)] p-3">
          <p className="text-xs text-amber-400 mb-2">Selecione um aliado:</p>
          <div className="flex flex-wrap gap-2">
            {aliveTeammates.map((teammate) => (
              <button
                key={teammate.playerId}
                type="button"
                onClick={() => handleAllySelect(teammate.playerId)}
                className="cursor-pointer rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-amber-400 hover:text-amber-400 transition-colors"
              >
                {teammate.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCancelSelection}
            className="mt-2 cursor-pointer text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Skip turn */}
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
