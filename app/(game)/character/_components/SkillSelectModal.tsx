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
  1: "bg-gray-600/40 text-gray-300",
  2: "bg-blue-600/40 text-blue-300",
  3: "bg-purple-600/40 text-purple-300",
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

export default function SkillSelectModal({
  open,
  slotIndex,
  allSkills,
  onSelect,
  onClose,
}: Props) {
  const [activeTiers, setActiveTiers] = useState<Set<number>>(
    () => new Set([1, 2, 3])
  );
  const [activeDamageTypes, setActiveDamageTypes] = useState<Set<string>>(
    () => new Set(["PHYSICAL", "MAGICAL", "NONE"])
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: captura Tab dentro do modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
    [onClose]
  );

  // Bind/unbind keyboard listener when modal opens/closes
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus the dialog on open
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
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  function toggleDamageType(dt: string) {
    setActiveDamageTypes((prev) => {
      const next = new Set(prev);
      if (next.has(dt)) {
        next.delete(dt);
      } else {
        next.add(dt);
      }
      return next;
    });
  }

  const filtered = allSkills.filter(
    (s) =>
      activeTiers.has(s.skill.tier) && activeDamageTypes.has(s.skill.damageType)
  );

  const isEmpty = allSkills.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Escolher habilidade para slot ${slotIndex + 1}`}
        tabIndex={-1}
        className="relative z-10 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-5 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            Escolher habilidade — Slot {slotIndex + 1}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="cursor-pointer text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Filtros */}
        {!isEmpty && (
          <div className="mb-4 space-y-2">
            {/* Tier toggles */}
            <div className="flex gap-2">
              {[1, 2, 3].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => toggleTier(tier)}
                  className={`cursor-pointer px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeTiers.has(tier)
                      ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30"
                      : "bg-[var(--bg-secondary)] text-gray-500 hover:bg-[var(--border-subtle)] hover:text-gray-300"
                  }`}
                >
                  T{tier}
                </button>
              ))}
            </div>

            {/* Damage type toggles */}
            <div className="flex gap-2">
              {(["PHYSICAL", "MAGICAL", "NONE"] as const).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => toggleDamageType(dt)}
                  className={`cursor-pointer px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeDamageTypes.has(dt)
                      ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30"
                      : "bg-[var(--bg-secondary)] text-gray-500 hover:bg-[var(--border-subtle)] hover:text-gray-300"
                  }`}
                >
                  {DAMAGE_TYPE_LABELS[dt]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista de skills */}
        <div className="overflow-y-auto flex-1">
          {isEmpty ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhuma habilidade desbloqueada
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhuma habilidade encontrada
            </p>
          ) : (
            filtered.map((entry) => {
              const { skill } = entry;
              const equippedElsewhere =
                entry.equipped && entry.slotIndex !== null && entry.slotIndex !== slotIndex;

              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => onSelect(skill.id, slotIndex)}
                  className="w-full text-left hover:bg-[var(--bg-secondary)] cursor-pointer rounded-lg p-3 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-200">
                      {skill.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TIER_COLORS[skill.tier] ?? ""}`}
                    >
                      T{skill.tier}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {DAMAGE_TYPE_LABELS[skill.damageType] ?? skill.damageType}
                    </span>
                    {skill.cooldown > 0 && (
                      <span className="text-[10px] text-gray-500">
                        CD {skill.cooldown}
                      </span>
                    )}
                    {equippedElsewhere && entry.slotIndex !== null && (
                      <span className="text-xs text-amber-400">
                        Slot {entry.slotIndex + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {skill.description}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
