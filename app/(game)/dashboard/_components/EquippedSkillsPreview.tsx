"use client";

import Link from "next/link";
import type { CharacterSkillSlot } from "@/types/skill";
import Panel from "@/components/ui/Panel";

const TYPE_COLORS: Record<string, string> = {
  MAGICAL: "#8fa8ff",
  PHYSICAL: "#ff8a70",
  BUFF: "#b9ff8a",
  HEAL: "#8fd8a6",
};

export default function EquippedSkillsPreview({
  skills,
  loading,
}: {
  skills: CharacterSkillSlot[];
  loading: boolean;
}) {
  return (
    <Panel title="Skills Equipadas" right="4 / 4">
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse"
              style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, idx) => {
            const slot = skills.find((s) => s.slotIndex === idx);
            const empty = !slot;
            const c = empty
              ? "color-mix(in srgb, var(--gold) 14%, transparent)"
              : (TYPE_COLORS[slot.skill.damageType] ?? "var(--ember)");

            return (
              <div
                key={idx}
                className="relative flex min-h-[82px] flex-col justify-between p-2"
                style={{
                  background: empty
                    ? "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--gold) 3%, transparent) 6px 7px)"
                    : "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
                  border: `1px solid color-mix(in srgb, var(--gold) ${empty ? "14%" : "20%"}, transparent)`,
                  opacity: empty ? 0.5 : 1,
                }}
              >
                {/* Slot index */}
                <span
                  className="absolute right-1.5 top-1 text-[7px] tracking-[0.15em]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "color-mix(in srgb, var(--gold) 40%, transparent)",
                  }}
                >
                  SLOT·{idx + 1}
                </span>

                {empty ? (
                  <div
                    className="flex flex-1 items-center justify-center text-[9px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 33%, transparent)",
                    }}
                  >
                    + Vazio
                  </div>
                ) : (
                  <>
                    {/* Type badge */}
                    <div
                      className="inline-flex items-center gap-1 self-start px-1 py-px text-[8px] tracking-[0.18em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: c,
                        border: `1px solid ${c}55`,
                      }}
                    >
                      <span
                        className="inline-block h-1 w-1 rounded-full"
                        style={{ background: c, boxShadow: `0 0 3px ${c}aa` }}
                      />
                      {slot.skill.damageType === "MAGICAL" ? "MAG" : "PHY"}
                    </div>

                    <div>
                      <div
                        className="mb-0.5 text-sm font-medium leading-tight text-white"
                        style={{ fontFamily: "var(--font-cormorant)" }}
                      >
                        {slot.skill.name}
                      </div>
                      <div
                        className="flex items-center justify-between text-[8px] tracking-[0.12em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                        }}
                      >
                        <span>TIER {slot.skill.tier}</span>
                        {slot.skill.cooldown > 0 ? (
                          <span style={{ color: "#d96a52" }}>CD · {slot.skill.cooldown}T</span>
                        ) : (
                          <span style={{ color: "#7acf8a" }}>● PRONTA</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/character"
        className="mt-3 block text-center text-xs italic transition-colors hover:text-white"
        style={{
          fontFamily: "var(--font-garamond)",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
        }}
      >
        Gerenciar grimorio
      </Link>
    </Panel>
  );
}
