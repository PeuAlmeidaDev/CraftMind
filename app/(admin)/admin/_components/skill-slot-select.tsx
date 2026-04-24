"use client";

import { useState, useRef, useEffect } from "react";

type SkillOption = {
  id: string;
  name: string;
  tier: number;
  damageType: string;
};

type SkillSlotSelectProps = {
  slotIndex: number;
  skills: SkillOption[];
  selectedSkillId: string | null;
  onChange: (skillId: string | null) => void;
  disabledSkillIds: string[];
};

const DAMAGE_COLORS: Record<string, string> = {
  PHYSICAL: "text-red-400",
  MAGICAL: "text-blue-400",
  NONE: "text-emerald-400",
};

export default function SkillSlotSelect({
  slotIndex,
  skills,
  selectedSkillId,
  onChange,
  disabledSkillIds,
}: SkillSlotSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = selectedSkillId ? skills.find((s) => s.id === selectedSkillId) : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = skills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1">Slot {slotIndex}</label>

      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
        className="w-full text-left bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="text-white">{selected.name}</span>
            <span className="text-[10px] text-gray-500">T{selected.tier}</span>
            <span className={`text-[10px] ${DAMAGE_COLORS[selected.damageType] ?? "text-gray-400"}`}>
              {selected.damageType}
            </span>
          </span>
        ) : (
          <span className="text-gray-500">Nenhuma</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skill..."
            className="w-full px-3 py-2 text-sm text-white bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] focus:outline-none"
            autoFocus
          />
          <div className="overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-white/5 cursor-pointer"
            >
              Nenhuma
            </button>
            {filtered.map((skill) => {
              const isDisabled = disabledSkillIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { onChange(skill.id); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-white/5 cursor-pointer"
                  } ${selectedSkillId === skill.id ? "bg-[var(--accent-primary)]/10" : ""}`}
                >
                  <span className="text-white flex-1 truncate">{skill.name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">T{skill.tier}</span>
                  <span className={`text-[10px] shrink-0 ${DAMAGE_COLORS[skill.damageType] ?? "text-gray-400"}`}>
                    {skill.damageType}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
