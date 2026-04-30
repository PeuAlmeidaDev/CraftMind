"use client";

// Tipos e UI compartilhados entre /admin/cards/new e /admin/cards/[id].
// Editor estruturado de um efeito unico (CardEffect discriminated union).

export type StatFlat = { type: "STAT_FLAT"; stat: string; value: number };
export type StatPercent = { type: "STAT_PERCENT"; stat: string; percent: number };
export type Trigger = { type: "TRIGGER"; trigger: string; payload: Record<string, unknown> };
export type StatusResist = { type: "STATUS_RESIST"; status: string; percent: number };
export type Effect = StatFlat | StatPercent | Trigger | StatusResist;

export const STAT_OPTIONS = [
  { value: "physicalAtk", label: "ATK Fisico" },
  { value: "physicalDef", label: "DEF Fisica" },
  { value: "magicAtk", label: "ATK Magico" },
  { value: "magicDef", label: "DEF Magica" },
  { value: "hp", label: "HP" },
  { value: "speed", label: "Velocidade" },
  { value: "accuracy", label: "Precisao" },
];

export const STATUS_OPTIONS = [
  { value: "STUN", label: "Stun" },
  { value: "FROZEN", label: "Frozen" },
  { value: "BURN", label: "Burn" },
  { value: "POISON", label: "Poison" },
  { value: "SLOW", label: "Slow" },
];

export const EFFECT_TYPE_OPTIONS = [
  { value: "STAT_FLAT", label: "Stat flat (+N)" },
  { value: "STAT_PERCENT", label: "Stat % (+N%)" },
  { value: "TRIGGER", label: "Trigger (Fase 2 — inerte)" },
  { value: "STATUS_RESIST", label: "Resist a status (Fase 2 — inerte)" },
];

export function makeDefaultEffect(type: string): Effect {
  switch (type) {
    case "STAT_PERCENT":
      return { type: "STAT_PERCENT", stat: "physicalAtk", percent: 5 };
    case "TRIGGER":
      return { type: "TRIGGER", trigger: "ON_LOW_HP", payload: {} };
    case "STATUS_RESIST":
      return { type: "STATUS_RESIST", status: "STUN", percent: 20 };
    case "STAT_FLAT":
    default:
      return { type: "STAT_FLAT", stat: "physicalAtk", value: 5 };
  }
}

type EffectRowProps = {
  index: number;
  effect: Effect;
  onChangeType: (type: string) => void;
  onUpdate: (patch: Partial<Effect>) => void;
  onRemove: () => void;
};

export default function EffectRow({
  index,
  effect,
  onChangeType,
  onUpdate,
  onRemove,
}: EffectRowProps) {
  const inputCls =
    "w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)]";

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)]">
      <div className="col-span-12 sm:col-span-4">
        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Tipo #{index + 1}
        </label>
        <select
          value={effect.type}
          onChange={(e) => onChangeType(e.target.value)}
          className={`${inputCls} cursor-pointer`}
        >
          {EFFECT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {effect.type === "STAT_FLAT" && (
        <>
          <div className="col-span-7 sm:col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Atributo
            </label>
            <select
              value={effect.stat}
              onChange={(e) => onUpdate({ stat: e.target.value } as Partial<StatFlat>)}
              className={`${inputCls} cursor-pointer`}
            >
              {STAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Valor
            </label>
            <input
              type="number"
              value={effect.value}
              onChange={(e) =>
                onUpdate({ value: parseInt(e.target.value, 10) || 0 } as Partial<StatFlat>)
              }
              className={inputCls}
            />
          </div>
        </>
      )}

      {effect.type === "STAT_PERCENT" && (
        <>
          <div className="col-span-7 sm:col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Atributo
            </label>
            <select
              value={effect.stat}
              onChange={(e) => onUpdate({ stat: e.target.value } as Partial<StatPercent>)}
              className={`${inputCls} cursor-pointer`}
            >
              {STAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              %
            </label>
            <input
              type="number"
              value={effect.percent}
              onChange={(e) =>
                onUpdate({ percent: parseInt(e.target.value, 10) || 0 } as Partial<StatPercent>)
              }
              className={inputCls}
            />
          </div>
        </>
      )}

      {effect.type === "STATUS_RESIST" && (
        <>
          <div className="col-span-7 sm:col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Status
            </label>
            <select
              value={effect.status}
              onChange={(e) => onUpdate({ status: e.target.value } as Partial<StatusResist>)}
              className={`${inputCls} cursor-pointer`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Resist %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={effect.percent}
              onChange={(e) =>
                onUpdate({ percent: parseInt(e.target.value, 10) || 0 } as Partial<StatusResist>)
              }
              className={inputCls}
            />
          </div>
        </>
      )}

      {effect.type === "TRIGGER" && (
        <div className="col-span-10 sm:col-span-7">
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            Trigger ID
          </label>
          <input
            type="text"
            value={effect.trigger}
            onChange={(e) => onUpdate({ trigger: e.target.value } as Partial<Trigger>)}
            placeholder="ex: ON_LOW_HP"
            className={inputCls}
          />
        </div>
      )}

      <div className="col-span-2 sm:col-span-1 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="h-[34px] w-full sm:w-[34px] rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition cursor-pointer flex items-center justify-center text-sm"
          aria-label="Remover efeito"
        >
          ×
        </button>
      </div>
    </div>
  );
}
