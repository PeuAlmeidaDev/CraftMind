"use client";

import { useState, useCallback } from "react";

type MasteryData = {
  maxLevel?: number;
  bonusPerLevel?: number;
};

type MasteryEditorProps = {
  value: string; // JSON string of SkillMastery
  onChange: (value: string) => void;
};

export default function MasteryEditor({ value, onChange }: MasteryEditorProps) {
  const [mastery, setMastery] = useState<MasteryData>(() => {
    try { return JSON.parse(value) as MasteryData; } catch { return {}; }
  });

  const sync = useCallback((data: MasteryData) => {
    setMastery(data);
    // Remove undefined/empty keys
    const clean: Record<string, number> = {};
    if (data.maxLevel !== undefined && data.maxLevel > 0) clean.maxLevel = data.maxLevel;
    if (data.bonusPerLevel !== undefined && data.bonusPerLevel > 0) clean.bonusPerLevel = data.bonusPerLevel;
    onChange(JSON.stringify(Object.keys(clean).length > 0 ? clean : {}));
  }, [onChange]);

  return (
    <div>
      <label className="text-sm font-medium text-gray-300 block mb-2">Mastery</label>
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-gray-500 block mb-0.5">Max Level</span>
            <input
              type="number"
              value={mastery.maxLevel ?? ""}
              min={0}
              max={10}
              placeholder="0"
              onChange={(e) => sync({ ...mastery, maxLevel: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white placeholder-gray-600"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block mb-0.5">Bonus/Level</span>
            <input
              type="number"
              value={mastery.bonusPerLevel ?? ""}
              min={0}
              max={100}
              placeholder="0"
              onChange={(e) => sync({ ...mastery, bonusPerLevel: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white placeholder-gray-600"
            />
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Deixe vazio para nenhuma mastery</p>
      </div>
    </div>
  );
}
