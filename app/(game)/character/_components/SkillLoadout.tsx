"use client";

import type { CharacterSkillSlot } from "@/types/skill";
import Panel from "@/components/ui/Panel";

type Props = {
  equipped: CharacterSkillSlot[];
  onSlotClick: (slotIndex: number) => void;
  onUnequip: (slotIndex: number) => void;
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

const SLOT_INDEXES = [0, 1, 2, 3] as const;

export default function SkillLoadout({ equipped, onSlotClick, onUnequip }: Props) {
  return (
    <Panel title="Loadout de Combate" right="4 slots">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SLOT_INDEXES.map((idx) => {
          const slot = equipped.find((s) => s.slotIndex === idx);

          if (slot) {
            const typeInfo = DAMAGE_TYPE_LABEL[slot.skill.damageType] ?? DAMAGE_TYPE_LABEL.NONE;

            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => onSlotClick(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSlotClick(idx);
                  }
                }}
                className="relative cursor-pointer"
                style={{
                  minHeight: 118,
                  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
                  border: "1px solid color-mix(in srgb, var(--gold) 27%, transparent)",
                  padding: "14px 12px 10px",
                }}
              >
                {/* Corner ticks */}
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: -1,
                    left: -1,
                    width: 10,
                    height: 10,
                    borderTop: "1px solid var(--ember)",
                    borderLeft: "1px solid var(--ember)",
                  }}
                />
                <span
                  className="pointer-events-none absolute"
                  style={{
                    bottom: -1,
                    right: -1,
                    width: 10,
                    height: 10,
                    borderBottom: "1px solid var(--ember)",
                    borderRight: "1px solid var(--ember)",
                  }}
                />

                {/* Slot label */}
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: 4,
                    left: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    color: "color-mix(in srgb, var(--gold) 40%, transparent)",
                    letterSpacing: "0.05em",
                  }}
                >
                  SLOT&middot;{idx + 1}
                </span>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnequip(idx);
                  }}
                  className="absolute flex cursor-pointer items-center justify-center"
                  style={{
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    border: "1px solid color-mix(in srgb, var(--gold) 27%, transparent)",
                    background: "transparent",
                    color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                    fontSize: 12,
                    lineHeight: 1,
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ff4444";
                    e.currentTarget.style.borderColor = "#ff4444";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "color-mix(in srgb, var(--gold) 50%, transparent)";
                    e.currentTarget.style.borderColor = "color-mix(in srgb, var(--gold) 27%, transparent)";
                  }}
                  aria-label={`Remover ${slot.skill.name}`}
                >
                  &times;
                </button>

                {/* Content area */}
                <div style={{ marginTop: 14 }}>
                  {/* Type badge */}
                  <div className="flex items-center" style={{ gap: 5, marginBottom: 4 }}>
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

                  {/* Skill name */}
                  <p
                    className="truncate"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: 17,
                      fontWeight: 600,
                      color: "#ffffff",
                      lineHeight: 1.2,
                      marginBottom: 6,
                      paddingRight: 20,
                    }}
                  >
                    {slot.skill.name}
                  </p>

                  {/* Footer: target + cooldown */}
                  <div
                    className="flex items-center"
                    style={{
                      gap: 8,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>{TARGET_LABELS[slot.skill.target] ?? slot.skill.target}</span>
                    {slot.skill.cooldown > 0 && (
                      <span>CD {slot.skill.cooldown}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          /* ---- Empty slot ---- */
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSlotClick(idx)}
              className="relative cursor-pointer"
              style={{
                minHeight: 118,
                border: "1px dashed color-mix(in srgb, var(--gold) 27%, transparent)",
                background: "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--gold) 3%, transparent) 6px 7px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--ember)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "color-mix(in srgb, var(--gold) 27%, transparent)";
              }}
            >
              {/* Slot label */}
              <span
                className="pointer-events-none absolute"
                style={{
                  top: 4,
                  left: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "color-mix(in srgb, var(--gold) 30%, transparent)",
                  letterSpacing: "0.05em",
                }}
              >
                SLOT&middot;{idx + 1}
              </span>

              <span
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--gold) 40%, transparent)",
                  letterSpacing: "0.08em",
                }}
              >
                + Escolher skill
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
