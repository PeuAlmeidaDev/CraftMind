"use client";

import type { CharacterSkillSlot, SkillEffect } from "@/types/skill";
import Panel from "@/components/ui/Panel";

type Props = {
  skills: CharacterSkillSlot[];
};

const TIER_COLORS: Record<number, string> = {
  1: "#9ba3ad",
  2: "#6b9dff",
  3: "#b06bff",
};

const DAMAGE_TYPE_LABEL: Record<string, { short: string; color: string }> = {
  PHYSICAL: { short: "PHY", color: "#ff8a70" },
  MAGICAL: { short: "MAG", color: "#8fa8ff" },
  NONE: { short: "SUP", color: "#b9ff8a" },
};

const TARGET_LABELS: Record<string, string> = {
  SELF: "PROPRIO",
  SINGLE_ENEMY: "1 INIMIGO",
  ALL_ENEMIES: "TODOS INIMIGOS",
  SINGLE_ALLY: "1 ALIADO",
  ALL_ALLIES: "TODOS ALIADOS",
  ALL: "TODOS",
};

const EFFECT_COLORS: Record<string, string> = {
  BUFF: "#8fd8a6",
  DEBUFF: "#ff8a70",
  STATUS: "#b06bff",
  HEAL: "#8fd8a6",
  RECOIL: "#ff6b6b",
  CLEANSE: "#6bffb8",
  SELF_DEBUFF: "#ffb86b",
  VULNERABILITY: "#d96a52",
  PRIORITY_SHIFT: "#6b9dff",
  COUNTER: "#f2c84a",
  COMBO: "#e8945a",
  ON_EXPIRE: "#9ba3ad",
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
      <Panel title="Grimorio" right="0 desbloqueadas">
        <p
          className="text-center"
          style={{
            fontFamily: "var(--font-garamond)",
            fontSize: 13,
            fontStyle: "italic",
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            padding: "20px 0",
          }}
        >
          Nenhuma habilidade desbloqueada. Complete tarefas diarias para desbloquear.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Grimorio" right={`${skills.length} desbloqueadas`}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {skills.map((slot) => {
          const { skill } = slot;
          const tierColor = TIER_COLORS[skill.tier] ?? TIER_COLORS[1];
          const typeInfo = DAMAGE_TYPE_LABEL[skill.damageType] ?? DAMAGE_TYPE_LABEL.NONE;
          const isEquipped = slot.equipped && slot.slotIndex !== null;

          return (
            <div
              key={skill.id}
              className="relative"
              style={{
                background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
                border: `1px solid ${isEquipped ? "var(--ember)" : "color-mix(in srgb, var(--gold) 14%, transparent)"}`,
                padding: "12px 10px 10px",
              }}
            >
              {/* Equipped badge */}
              {isEquipped && (
                <span
                  className="absolute"
                  style={{
                    top: 0,
                    right: 0,
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 8,
                    background: "var(--ember)",
                    color: "var(--bg-primary)",
                    padding: "2px 6px",
                    letterSpacing: "0.04em",
                    fontWeight: 600,
                  }}
                >
                  ✦ Slot {(slot.slotIndex as number) + 1}
                </span>
              )}

              {/* Top row: tier + type */}
              <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
                {/* Tier badge */}
                <span
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    padding: "1px 6px",
                    border: `1px solid ${tierColor}`,
                    background: `color-mix(in srgb, ${tierColor} 7%, transparent)`,
                    color: tierColor,
                    letterSpacing: "0.04em",
                  }}
                >
                  T{skill.tier}
                </span>

                {/* Type badge */}
                <div className="flex items-center" style={{ gap: 4 }}>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: typeInfo.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      color: typeInfo.color,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {typeInfo.short}
                  </span>
                </div>
              </div>

              {/* Skill name */}
              <p
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#ffffff",
                  lineHeight: 1.2,
                  marginBottom: 4,
                  paddingRight: isEquipped ? 50 : 0,
                }}
              >
                {skill.name}
              </p>

              {/* Footer: target + cooldown */}
              <div
                className="flex items-center"
                style={{
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                <span>{TARGET_LABELS[skill.target] ?? skill.target}</span>
                {skill.cooldown > 0 && <span>CD {skill.cooldown}</span>}
              </div>

              {/* Description */}
              <p
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--gold) 87%, transparent)",
                  lineHeight: 1.4,
                  marginBottom: skill.effects.length > 0 ? 8 : 0,
                }}
              >
                {skill.description}
              </p>

              {/* Effects */}
              {skill.effects.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 4 }}>
                  {skill.effects.map((effect, effectIdx) => {
                    const effectColor = EFFECT_COLORS[effect.type] ?? "#9ba3ad";
                    return (
                      <span
                        key={effectIdx}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 8,
                          color: effectColor,
                          border: `1px solid color-mix(in srgb, ${effectColor} 27%, transparent)`,
                          background: `color-mix(in srgb, ${effectColor} 6%, transparent)`,
                          padding: "1px 5px",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {renderEffect(effect)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
