"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterSkillSlot } from "@/types/skill";

type Props = {
  open: boolean;
  slotIndex: number;
  allSkills: CharacterSkillSlot[];
  onSelect: (skillId: string, slotIndex: number) => void;
  onClose: () => void;
};

const TIER_COLORS: Record<number, string> = {
  1: "#9ba3ad",
  2: "#6b9dff",
  3: "#b06bff",
};

const TYPE_INFO: Record<string, { label: string; color: string }> = {
  PHYSICAL: { label: "Fisico", color: "#ff8a70" },
  MAGICAL: { label: "Magico", color: "#8fa8ff" },
  NONE: { label: "Suporte", color: "#b9ff8a" },
};

export default function SkillSelectModal({
  open,
  slotIndex,
  allSkills,
  onSelect,
  onClose,
}: Props) {
  const [activeTiers, setActiveTiers] = useState<Set<number>>(
    () => new Set([1, 2, 3]),
  );
  const [activeDamageTypes, setActiveDamageTypes] = useState<Set<string>>(
    () => new Set(["PHYSICAL", "MAGICAL", "NONE"]),
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);

    const timer = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(timer);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  function toggleTier(tier: number) {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  function toggleDamageType(dt: string) {
    setActiveDamageTypes((prev) => {
      const next = new Set(prev);
      if (next.has(dt)) next.delete(dt);
      else next.add(dt);
      return next;
    });
  }

  const filtered = allSkills.filter(
    (s) =>
      activeTiers.has(s.skill.tier) && activeDamageTypes.has(s.skill.damageType),
  );

  const isEmpty = allSkills.length === 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{
        background: "rgba(5, 3, 10, 0.82)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Escolher habilidade para slot ${slotIndex + 1}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[720px] flex-col outline-none"
        style={{
          maxHeight: "calc(100vh - 48px)",
          background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--ember) 40%, transparent)",
          boxShadow: "0 30px 80px var(--bg-primary), 0 0 40px color-mix(in srgb, var(--ember) 14%, transparent)",
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.35em]"
              style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
            >
              Slot {slotIndex + 1}
            </div>
            <h2
              className="mt-1 text-[26px] font-medium text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Escolher habilidade
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 cursor-pointer items-center justify-center text-lg transition-colors"
            style={{
              fontFamily: "monospace",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
            }}
          >
            &times;
          </button>
        </header>

        {/* Filtros */}
        {!isEmpty && (
          <div
            className="flex flex-wrap gap-4 border-b px-5 py-3.5"
            style={{ borderColor: "color-mix(in srgb, var(--gold) 8%, transparent)" }}
          >
            {/* Tier filter */}
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
              >
                Tier
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map((tier) => {
                  const active = activeTiers.has(tier);
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => toggleTier(tier)}
                      className="cursor-pointer px-2 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: active ? "#fff" : "color-mix(in srgb, var(--gold) 67%, transparent)",
                        background: active ? "color-mix(in srgb, var(--ember) 20%, transparent)" : "transparent",
                        border: `1px solid ${active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                      }}
                    >
                      T{tier}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
              >
                Tipo
              </span>
              <div className="flex gap-1">
                {(["PHYSICAL", "MAGICAL", "NONE"] as const).map((dt) => {
                  const active = activeDamageTypes.has(dt);
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => toggleDamageType(dt)}
                      className="cursor-pointer px-2 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: active ? "#fff" : "color-mix(in srgb, var(--gold) 67%, transparent)",
                        background: active ? "color-mix(in srgb, var(--ember) 20%, transparent)" : "transparent",
                        border: `1px solid ${active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                      }}
                    >
                      {TYPE_INFO[dt]?.label ?? dt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-3.5">
          {isEmpty ? (
            <div
              className="py-9 text-center italic"
              style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 47%, transparent)" }}
            >
              Nenhuma habilidade desbloqueada.
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="py-9 text-center italic"
              style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 47%, transparent)" }}
            >
              Nenhuma habilidade corresponde aos filtros.
            </div>
          ) : (
            filtered.map((entry) => {
              const { skill } = entry;
              const equipped = entry.equipped && entry.slotIndex !== null;
              const tierColor = TIER_COLORS[skill.tier] ?? TIER_COLORS[1];
              const typeInfo = TYPE_INFO[skill.damageType] ?? { label: skill.damageType, color: "#999" };

              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => onSelect(skill.id, slotIndex)}
                  className="grid w-full cursor-pointer items-center gap-3 p-3 text-left transition-all"
                  style={{
                    gridTemplateColumns: "1fr auto",
                    background: equipped
                      ? "color-mix(in srgb, var(--gold) 6%, transparent)"
                      : "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
                    border: `1px solid color-mix(in srgb, var(--gold) ${equipped ? "40%" : "14%"}, transparent)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ember)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `color-mix(in srgb, var(--gold) ${equipped ? "40%" : "14%"}, transparent)`;
                  }}
                >
                  <div className="min-w-0">
                    {/* Badges */}
                    <div className="mb-1 flex items-center gap-1.5">
                      {/* Tier */}
                      <span
                        className="px-1.5 py-px text-[9px] tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: tierColor,
                          border: `1px solid ${tierColor}66`,
                        }}
                      >
                        T{skill.tier}
                      </span>
                      {/* Type */}
                      <span
                        className="inline-flex items-center gap-1 px-1 py-px text-[8px] uppercase tracking-[0.2em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: typeInfo.color,
                          border: `1px solid ${typeInfo.color}55`,
                        }}
                      >
                        <span
                          className="inline-block h-1 w-1 rounded-full"
                          style={{ background: typeInfo.color, boxShadow: `0 0 3px ${typeInfo.color}aa` }}
                        />
                        {typeInfo.label}
                      </span>
                      {/* Equipped badge */}
                      {equipped && entry.slotIndex !== null && (
                        <span
                          className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                          style={{
                            fontFamily: "var(--font-cinzel)",
                            color: "var(--gold)",
                            border: "1px solid color-mix(in srgb, var(--gold) 53%, transparent)",
                          }}
                        >
                          EQUIPADA S{entry.slotIndex + 1}
                        </span>
                      )}
                    </div>
                    {/* Name */}
                    <div
                      className="text-[17px] font-medium text-white"
                      style={{ fontFamily: "var(--font-cormorant)" }}
                    >
                      {skill.name}
                    </div>
                    {/* Description */}
                    <div
                      className="mt-0.5 text-xs italic"
                      style={{
                        fontFamily: "var(--font-garamond)",
                        color: "color-mix(in srgb, var(--gold) 67%, transparent)",
                        textWrap: "pretty",
                      }}
                    >
                      {skill.description}
                    </div>
                  </div>
                  {/* Stats */}
                  <div
                    className="text-right text-[9px] tracking-[0.15em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                    }}
                  >
                    <div>{skill.target.replace(/_/g, " ")}</div>
                    <div>{skill.cooldown > 0 ? `CD\u00B7${skill.cooldown}T` : "SEM CD"}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
