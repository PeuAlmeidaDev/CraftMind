"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types matching types/skill.ts
// ---------------------------------------------------------------------------

const EFFECT_TYPES = [
  "BUFF", "DEBUFF", "STATUS", "VULNERABILITY", "PRIORITY_SHIFT",
  "COUNTER", "HEAL", "CLEANSE", "RECOIL", "SELF_DEBUFF",
] as const;

const STAT_OPTIONS = [
  { value: "physicalAtk", label: "P. ATK" },
  { value: "physicalDef", label: "P. DEF" },
  { value: "magicAtk", label: "M. ATK" },
  { value: "magicDef", label: "M. DEF" },
  { value: "hp", label: "HP" },
  { value: "speed", label: "Speed" },
  { value: "accuracy", label: "Acuracia" },
];

const STATUS_OPTIONS = ["STUN", "FROZEN", "BURN", "POISON", "SLOW"];
const TARGET_OPTIONS = ["SELF", "SINGLE_ALLY", "ALL_ALLIES", "SINGLE_ENEMY", "ALL_ENEMIES", "ALL"];
const DAMAGE_TYPE_OPTIONS = ["PHYSICAL", "MAGICAL", "NONE"];
const CLEANSE_TARGET_OPTIONS = ["DEBUFFS", "STATUS", "ALL"];

type EffectEntry = Record<string, unknown>;

type EffectEditorProps = {
  value: string; // JSON string of SkillEffect[]
  onChange: (value: string) => void;
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const fieldClass = "bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white w-full";
const selectClass = `${fieldClass} cursor-pointer`;
const labelClass = "text-[10px] text-gray-500 block mb-0.5";

function NumField({ label, value, onChange, min = 0, max = 9999 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={fieldClass} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }> | string[];
}) {
  const opts = typeof options[0] === "string"
    ? (options as string[]).map((o) => ({ value: o, label: o }))
    : (options as Array<{ value: string; label: string }>);

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fields per effect type
// ---------------------------------------------------------------------------

function EffectFields({ effect, onUpdate }: { effect: EffectEntry; onUpdate: (e: EffectEntry) => void }) {
  const type = effect.type as string;
  const set = (key: string, val: unknown) => onUpdate({ ...effect, [key]: val });

  const targetField = (
    <SelectField label="Target" value={(effect.target as string) ?? "SINGLE_ENEMY"} onChange={(v) => set("target", v)} options={TARGET_OPTIONS} />
  );

  switch (type) {
    case "BUFF":
    case "DEBUFF":
    case "SELF_DEBUFF":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {targetField}
          <SelectField label="Stat" value={(effect.stat as string) ?? "physicalAtk"} onChange={(v) => set("stat", v)} options={STAT_OPTIONS} />
          <NumField label="Value" value={(effect.value as number) ?? 10} onChange={(v) => set("value", v)} />
          <NumField label="Duracao" value={(effect.duration as number) ?? 2} onChange={(v) => set("duration", v)} min={1} max={10} />
          {type !== "SELF_DEBUFF" && (
            <NumField label="Chance %" value={(effect.chance as number) ?? 100} onChange={(v) => set("chance", v)} min={1} max={100} />
          )}
        </div>
      );

    case "STATUS":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {targetField}
          <SelectField label="Status" value={(effect.status as string) ?? "STUN"} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
          <NumField label="Chance %" value={(effect.chance as number) ?? 30} onChange={(v) => set("chance", v)} min={1} max={100} />
          <NumField label="Duracao" value={(effect.duration as number) ?? 1} onChange={(v) => set("duration", v)} min={1} max={10} />
        </div>
      );

    case "HEAL":
      return (
        <div className="grid grid-cols-2 gap-2">
          {targetField}
          <NumField label="Percent %" value={(effect.percent as number) ?? 20} onChange={(v) => set("percent", v)} min={1} max={100} />
        </div>
      );

    case "VULNERABILITY":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {targetField}
          <SelectField label="Damage Type" value={(effect.damageType as string) ?? "PHYSICAL"} onChange={(v) => set("damageType", v)} options={DAMAGE_TYPE_OPTIONS} />
          <NumField label="Percent %" value={(effect.percent as number) ?? 20} onChange={(v) => set("percent", v)} min={1} max={100} />
          <NumField label="Duracao" value={(effect.duration as number) ?? 2} onChange={(v) => set("duration", v)} min={1} max={10} />
        </div>
      );

    case "PRIORITY_SHIFT":
      return (
        <div className="grid grid-cols-3 gap-2">
          {targetField}
          <NumField label="Stages" value={(effect.stages as number) ?? 1} onChange={(v) => set("stages", v)} min={-3} max={3} />
          <NumField label="Duracao" value={(effect.duration as number) ?? 2} onChange={(v) => set("duration", v)} min={1} max={10} />
        </div>
      );

    case "COUNTER":
      return (
        <div className="grid grid-cols-3 gap-2">
          {targetField}
          <NumField label="Power Multi" value={(effect.powerMultiplier as number) ?? 0.5} onChange={(v) => set("powerMultiplier", v)} />
          <NumField label="Duracao" value={(effect.duration as number) ?? 1} onChange={(v) => set("duration", v)} min={1} max={10} />
        </div>
      );

    case "CLEANSE":
      return (
        <div className="grid grid-cols-2 gap-2">
          {targetField}
          <SelectField label="Limpar" value={(effect.targets as string) ?? "ALL"} onChange={(v) => set("targets", v)} options={CLEANSE_TARGET_OPTIONS} />
        </div>
      );

    case "RECOIL":
      return (
        <div className="grid grid-cols-2 gap-2">
          {targetField}
          <NumField label="% do Dano" value={(effect.percentOfDamage as number) ?? 25} onChange={(v) => set("percentOfDamage", v)} min={1} max={100} />
        </div>
      );

    default:
      return <p className="text-xs text-gray-500">Tipo desconhecido</p>;
  }
}

// ---------------------------------------------------------------------------
// Defaults per type
// ---------------------------------------------------------------------------

function defaultEffect(type: string): EffectEntry {
  const base = { type, target: "SINGLE_ENEMY" };
  switch (type) {
    case "BUFF":
    case "DEBUFF":
      return { ...base, stat: "physicalAtk", value: 10, duration: 2, chance: 100 };
    case "SELF_DEBUFF":
      return { ...base, target: "SELF", stat: "speed", value: 5, duration: 2 };
    case "STATUS":
      return { ...base, status: "STUN", chance: 30, duration: 1 };
    case "HEAL":
      return { ...base, target: "SELF", percent: 20 };
    case "VULNERABILITY":
      return { ...base, damageType: "PHYSICAL", percent: 20, duration: 2 };
    case "PRIORITY_SHIFT":
      return { ...base, target: "SELF", stages: 1, duration: 2 };
    case "COUNTER":
      return { ...base, target: "SELF", powerMultiplier: 0.5, duration: 1 };
    case "CLEANSE":
      return { ...base, target: "SELF", targets: "ALL" };
    case "RECOIL":
      return { ...base, target: "SELF", percentOfDamage: 25 };
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  BUFF: "Buff",
  DEBUFF: "Debuff",
  STATUS: "Status",
  VULNERABILITY: "Vulnerabilidade",
  PRIORITY_SHIFT: "Prioridade",
  COUNTER: "Contra-ataque",
  HEAL: "Cura",
  CLEANSE: "Limpeza",
  RECOIL: "Recoil",
  SELF_DEBUFF: "Auto-debuff",
};

export default function EffectEditor({ value, onChange }: EffectEditorProps) {
  const [effects, setEffects] = useState<EffectEntry[]>(() => {
    try { return JSON.parse(value) as EffectEntry[]; } catch { return []; }
  });

  const sync = useCallback((arr: EffectEntry[]) => {
    setEffects(arr);
    onChange(JSON.stringify(arr));
  }, [onChange]);

  function addEffect() {
    sync([...effects, defaultEffect("BUFF")]);
  }

  function removeEffect(index: number) {
    sync(effects.filter((_, i) => i !== index));
  }

  function updateEffect(index: number, updated: EffectEntry) {
    sync(effects.map((e, i) => (i === index ? updated : e)));
  }

  function changeType(index: number, newType: string) {
    sync(effects.map((e, i) => (i === index ? defaultEffect(newType) : e)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">Effects ({effects.length})</label>
        <button
          type="button"
          onClick={addEffect}
          className="text-xs px-2.5 py-1 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition cursor-pointer"
        >
          + Adicionar
        </button>
      </div>

      {effects.length === 0 && (
        <p className="text-xs text-gray-500 py-3 text-center border border-dashed border-[var(--border-subtle)] rounded-lg">
          Nenhum efeito
        </p>
      )}

      <div className="space-y-3">
        {effects.map((effect, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <select
                value={effect.type as string}
                onChange={(e) => changeType(idx, e.target.value)}
                className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white cursor-pointer font-medium"
              >
                {EFFECT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeEffect(idx)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Remover
              </button>
            </div>
            <EffectFields effect={effect} onUpdate={(e) => updateEffect(idx, e)} />
          </div>
        ))}
      </div>
    </div>
  );
}
