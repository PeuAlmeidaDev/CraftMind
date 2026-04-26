"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkillInfo = {
  skillId: string;
  slotIndex: number;
  name: string;
  description: string;
  basePower: number;
  damageType: string;
  target: string;
  cooldown: number;
  accuracy: number;
};

type PvpTeamSkillBarProps = {
  skills: SkillInfo[];
  onSkillSelect: (skillId: string, target: string) => void;
  onSkipTurn: () => void;
  disabled: boolean;
  targetingMode: "SINGLE_ENEMY" | "SINGLE_ALLY" | null;
  pendingSkillId: string | null;
  onCancelTargeting: () => void;
};

// ---------------------------------------------------------------------------
// Constants (identical to CoopPveSkillBar)
// ---------------------------------------------------------------------------

const DAMAGE_TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

const TARGET_LABEL: Record<string, string> = {
  SINGLE_ENEMY: "1 Inimigo",
  ALL_ENEMIES: "Todos Inimigos",
  SELF: "Proprio",
  SINGLE_ALLY: "1 Aliado",
  ALL_ALLIES: "Todos Aliados",
};

// ---------------------------------------------------------------------------
// Component (identical design to CoopPveSkillBar)
// ---------------------------------------------------------------------------

export default function PvpTeamSkillBar({
  skills,
  onSkillSelect,
  onSkipTurn,
  disabled,
  targetingMode,
  pendingSkillId,
  onCancelTargeting,
}: PvpTeamSkillBarProps) {
  const isTargeting = targetingMode !== null;

  return (
    <div className="space-y-3">
      {/* Targeting message (identical to CoopPveSkillBar) */}
      {isTargeting && (
        <div className="flex items-center justify-between rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 px-2 sm:px-3 py-2 gap-2">
          <span className="text-xs sm:text-sm text-[var(--accent-primary)]">
            {targetingMode === "SINGLE_ENEMY"
              ? "Selecione um inimigo alvo..."
              : "Selecione um aliado..."}
          </span>
          <button
            type="button"
            onClick={onCancelTargeting}
            className="text-xs font-medium text-red-400 hover:text-red-300 transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Skill grid 2x2 (identical to CoopPveSkillBar) */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {skills.map((skill) => {
          const isPending = pendingSkillId === skill.skillId;
          const isOnCooldown = skill.cooldown > 0;
          const isDisabled = disabled || isTargeting || isOnCooldown;

          return (
            <button
              key={skill.skillId}
              type="button"
              onClick={() => {
                if (isDisabled) return;
                onSkillSelect(skill.skillId, skill.target);
              }}
              disabled={isDisabled}
              className={`relative rounded-lg border p-2 sm:p-2.5 text-left transition cursor-pointer ${
                isPending
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                  : isOnCooldown
                  ? "border-[var(--border-subtle)] bg-[var(--bg-primary)] opacity-50"
                  : isDisabled
                  ? "border-[var(--border-subtle)] bg-[var(--bg-primary)] opacity-60 cursor-not-allowed"
                  : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5"
              }`}
            >
              {/* Cooldown overlay (identical to CoopPveSkillBar) */}
              {isOnCooldown && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                  <span className="text-xs font-bold text-gray-300">
                    CD: {skill.cooldown}
                  </span>
                </div>
              )}

              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                {skill.name}
              </p>

              <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-gray-400">
                {skill.basePower > 0 && (
                  <span className="text-gray-300 font-medium">
                    {skill.basePower}
                  </span>
                )}
                <span>{DAMAGE_TYPE_LABEL[skill.damageType] ?? skill.damageType}</span>
                <span className="text-gray-500">|</span>
                <span>{TARGET_LABEL[skill.target] ?? skill.target}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Skip turn (identical to CoopPveSkillBar) */}
      <button
        type="button"
        onClick={onSkipTurn}
        disabled={disabled || isTargeting}
        className="w-full rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-gray-400 border border-[var(--border-subtle)] hover:text-white hover:border-gray-500 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
      >
        Pular turno
      </button>
    </div>
  );
}
