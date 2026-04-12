"use client";

import type { CharacterSkillSlot, SkillEffect } from "@/types/skill";

type Props = {
  skills: CharacterSkillSlot[];
};

const TIER_STYLES: Record<number, string> = {
  1: "text-gray-400 bg-gray-500/15",
  2: "text-blue-400 bg-blue-500/15",
  3: "text-purple-400 bg-purple-500/15",
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

const TARGET_LABELS: Record<string, string> = {
  SELF: "Proprio",
  SINGLE_ENEMY: "1 Inimigo",
  ALL_ENEMIES: "Todos Inimigos",
  SINGLE_ALLY: "1 Aliado",
  ALL_ALLIES: "Todos Aliados",
  ALL: "Todos",
};

function renderEffect(effect: SkillEffect): string {
  switch (effect.type) {
    case "BUFF":
      return `+${effect.value} ${effect.stat} (${effect.duration}t)`;
    case "DEBUFF":
      return `-${effect.value} ${effect.stat} (${effect.duration}t)`;
    case "STATUS":
      return `${effect.status} ${effect.chance}% (${effect.duration}t)`;
    case "HEAL":
      return `Cura ${effect.percent}%`;
    case "RECOIL":
      return `Recoil ${effect.percentOfDamage}%`;
    case "CLEANSE":
      return `Limpa ${effect.targets}`;
    case "SELF_DEBUFF":
      return `-${effect.value} ${effect.stat} (${effect.duration}t)`;
    case "VULNERABILITY":
      return `Vuln ${effect.damageType} ${effect.percent}% (${effect.duration}t)`;
    case "PRIORITY_SHIFT":
      return `Prioridade ${effect.stages > 0 ? "+" : ""}${effect.stages} (${effect.duration}t)`;
    case "COUNTER":
      return `Counter x${effect.powerMultiplier} (${effect.duration}t)`;
    case "COMBO":
      return `Combo max ${effect.maxStacks} stacks`;
    case "ON_EXPIRE":
      return `On Expire: ${effect.trigger.type}`;
    default:
      return "Efeito";
  }
}

export default function SkillInventory({ skills }: Props) {
  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <p className="text-center text-sm text-gray-400">
          Nenhuma habilidade desbloqueada. Complete tarefas diarias para
          desbloquear.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Habilidades desbloqueadas ({skills.length}/49)
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((slot) => {
          const { skill } = slot;
          const tierStyle = TIER_STYLES[skill.tier] ?? TIER_STYLES[1];

          return (
            <div
              key={skill.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-200">
                  {skill.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {slot.equipped && slot.slotIndex !== null && (
                    <span className="text-xs text-amber-400">
                      Slot {slot.slotIndex + 1}
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tierStyle}`}
                  >
                    T{skill.tier}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">
                  {DAMAGE_TYPE_LABELS[skill.damageType] ?? skill.damageType}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-500">
                  {TARGET_LABELS[skill.target] ?? skill.target}
                </span>
                {skill.cooldown > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-500">
                      Cooldown: {skill.cooldown} turno(s)
                    </span>
                  </>
                )}
              </div>

              <p className="mt-2 text-xs text-gray-400">{skill.description}</p>

              {skill.effects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {skill.effects.map((effect, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-gray-300"
                    >
                      {renderEffect(effect)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
