"use client";

import type { AvailableSkill } from "../page";

type SkillBarProps = {
  skills: AvailableSkill[];
  onSkillUse: (skillId: string) => void;
  onSkipTurn: () => void;
  disabled: boolean;
};

const DAMAGE_TYPE_LABEL: Record<string, { text: string; color: string }> = {
  PHYSICAL: { text: "Fisico", color: "#ff8a70" },
  MAGICAL: { text: "Magico", color: "#a78bfa" },
  NONE: { text: "Suporte", color: "#7acf8a" },
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
      {/* Eyebrow header */}
      <div className="flex justify-between items-center mb-2">
        <span
          style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: 9,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Arsenal
        </span>
        <span
          style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: 9,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--gold) 50%, transparent)",
          }}
        >
          4 SLOTS
        </span>
      </div>

      {/* Skill grid */}
      <div className="grid grid-cols-2 gap-[6px]">
        {slots.map((skill, idx) => {
          if (!skill) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[74px] grid place-items-center"
                style={{
                  border:
                    "1px dashed color-mix(in srgb, var(--gold) 20%, transparent)",
                  opacity: 0.5,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color:
                      "color-mix(in srgb, var(--gold) 40%, transparent)",
                  }}
                >
                  VAZIO
                </span>
              </div>
            );
          }

          const inCooldown = skill.cooldown > 0;
          const isDisabled = disabled || inCooldown;
          const dmgType = DAMAGE_TYPE_LABEL[skill.damageType] ?? {
            text: skill.damageType,
            color: "#999",
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
              className="relative min-h-[74px] p-[9px_10px] text-left flex flex-col gap-[3px] transition-all duration-[160ms]"
              style={{
                background:
                  "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
                border: `1px solid ${
                  isDisabled
                    ? "color-mix(in srgb, var(--gold) 13%, transparent)"
                    : `${dmgType.color}66`
                }`,
                cursor: isDisabled ? "not-allowed" : "pointer",
                boxShadow: isDisabled
                  ? "none"
                  : `inset 0 0 0 1px ${dmgType.color}17`,
              }}
            >
              {/* Line 1: type + power */}
              <div className="flex justify-between items-center">
                <span
                  className="inline-flex items-center gap-[4px]"
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: dmgType.color,
                  }}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: dmgType.color,
                    }}
                  />
                  {dmgType.text}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 16,
                    color: "#fff",
                    fontStyle: "italic",
                  }}
                >
                  {skill.basePower > 0 ? skill.basePower : "\u2014"}
                </span>
              </div>

              {/* Line 2: skill name */}
              <div
                className="overflow-hidden text-ellipsis whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: 15,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {skill.name}
              </div>

              {/* Cooldown overlay */}
              {inCooldown && (
                <div
                  className="absolute inset-0 grid place-items-center"
                  style={{
                    background: "rgba(0,0,0,0.7)",
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 14,
                    letterSpacing: "0.3em",
                    color: "#ff8a70",
                    fontWeight: 500,
                  }}
                >
                  CD &middot; {skill.cooldown}T
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Skip turn button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onSkipTurn}
        className="w-full mt-2 py-[10px]"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
          background: "transparent",
          fontFamily: "var(--font-cinzel)",
          fontSize: 10,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Pular Turno
      </button>
    </div>
  );
}
