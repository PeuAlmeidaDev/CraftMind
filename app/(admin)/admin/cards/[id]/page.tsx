"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../_components/toast";
import FormField from "../../_components/form-field";

const RARITY_OPTIONS = [
  { value: "COMUM", label: "Comum" },
  { value: "INCOMUM", label: "Incomum" },
  { value: "RARO", label: "Raro" },
  { value: "EPICO", label: "Epico" },
  { value: "LENDARIO", label: "Lendario" },
];

const STAT_OPTIONS = [
  { value: "physicalAtk", label: "ATK Fisico" },
  { value: "physicalDef", label: "DEF Fisica" },
  { value: "magicAtk", label: "ATK Magico" },
  { value: "magicDef", label: "DEF Magica" },
  { value: "hp", label: "HP" },
  { value: "speed", label: "Velocidade" },
  { value: "accuracy", label: "Precisao" },
];

const STATUS_OPTIONS = [
  { value: "STUN", label: "Stun" },
  { value: "FROZEN", label: "Frozen" },
  { value: "BURN", label: "Burn" },
  { value: "POISON", label: "Poison" },
  { value: "SLOW", label: "Slow" },
];

const EFFECT_TYPE_OPTIONS = [
  { value: "STAT_FLAT", label: "Stat flat (+N)" },
  { value: "STAT_PERCENT", label: "Stat % (+N%)" },
  { value: "TRIGGER", label: "Trigger (Fase 2 — inerte)" },
  { value: "STATUS_RESIST", label: "Resist a status (Fase 2 — inerte)" },
];

type StatFlat = { type: "STAT_FLAT"; stat: string; value: number };
type StatPercent = { type: "STAT_PERCENT"; stat: string; percent: number };
type Trigger = { type: "TRIGGER"; trigger: string; payload: Record<string, unknown> };
type StatusResist = { type: "STATUS_RESIST"; status: string; percent: number };
type Effect = StatFlat | StatPercent | Trigger | StatusResist;

type CardData = {
  id: string;
  mobId: string;
  name: string;
  flavorText: string;
  rarity: string;
  cardArtUrl: string | null;
  effects: Effect[];
  mob: { id: string; name: string; tier: number; imageUrl: string | null };
};

function makeDefaultEffect(type: string): Effect {
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

export default function EditCardPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [card, setCard] = useState<CardData | null>(null);

  const [name, setName] = useState("");
  const [flavorText, setFlavorText] = useState("");
  const [rarity, setRarity] = useState("COMUM");
  const [effects, setEffects] = useState<Effect[]>([]);

  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/admin/cards/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (!json) return;
        const data: CardData = json.data;
        setCard(data);
        setName(data.name);
        setFlavorText(data.flavorText);
        setRarity(data.rarity);
        setEffects(Array.isArray(data.effects) ? data.effects : []);
      })
      .catch(() => showToast("Erro ao carregar card", "error"))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  function updateEffect(index: number, patch: Partial<Effect>) {
    setEffects((prev) =>
      prev.map((eff, i) =>
        i === index ? ({ ...eff, ...patch } as Effect) : eff,
      ),
    );
  }

  function changeEffectType(index: number, newType: string) {
    setEffects((prev) =>
      prev.map((eff, i) => (i === index ? makeDefaultEffect(newType) : eff)),
    );
  }

  function addEffect() {
    setEffects((prev) => [...prev, makeDefaultEffect("STAT_FLAT")]);
  }

  function removeEffect(index: number) {
    setEffects((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/cards/${id}/image`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro no upload", "error");
        return;
      }
      setCard((prev) =>
        prev ? { ...prev, cardArtUrl: json.data.cardArtUrl } : prev,
      );
      showToast("Arte atualizada", "success");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleImageDelete() {
    setDeletingImage(true);
    try {
      const res = await fetch(`/api/admin/cards/${id}/image`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao remover", "error");
        return;
      }
      setCard((prev) => (prev ? { ...prev, cardArtUrl: null } : prev));
      showToast("Arte removida", "success");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setDeletingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) {
      setErrors({ name: "Nome obrigatorio" });
      return;
    }
    if (!flavorText.trim()) {
      setErrors({ flavorText: "Flavor text obrigatorio" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          flavorText: flavorText.trim(),
          rarity,
          effects,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao salvar", "error");
        if (json.details) {
          console.error("Validation details:", json.details);
        }
        return;
      }
      showToast("Card salvo", "success");
      router.push("/admin/cards");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Card nao encontrado</p>
        <Link
          href="/admin/cards"
          className="text-[var(--accent-primary)] hover:underline text-sm mt-3 inline-block"
        >
          ← Voltar para cards
        </Link>
      </div>
    );
  }

  const previewUrl = card.cardArtUrl ?? card.mob.imageUrl;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/admin/cards"
          className="text-gray-400 hover:text-white transition text-sm"
        >
          ← Cards
        </Link>
        <span className="text-gray-600">/</span>
        <h2 className="text-xl font-bold text-white">{card.name}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Coluna esquerda — preview e upload */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
            <p className="text-xs text-gray-500 mb-2">Arte da carta</p>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--bg-secondary)]">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={card.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-4xl text-gray-600">
                    {card.name.charAt(0)}
                  </span>
                </div>
              )}
              {!card.cardArtUrl && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-amber-400">
                    Usando foto do mob
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 text-xs py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition cursor-pointer disabled:opacity-50"
              >
                {uploading ? "Enviando..." : "Trocar foto"}
              </button>
              {card.cardArtUrl && (
                <button
                  type="button"
                  onClick={handleImageDelete}
                  disabled={deletingImage}
                  className="flex-1 text-xs py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer disabled:opacity-50"
                >
                  {deletingImage ? "..." : "Excluir foto"}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-xs text-gray-400 space-y-1">
            <p>
              <span className="text-gray-500">Mob:</span>{" "}
              <span className="text-white">{card.mob.name}</span>
            </p>
            <p>
              <span className="text-gray-500">Tier:</span> T{card.mob.tier}
            </p>
            <p className="text-[10px] text-gray-600 italic mt-2">
              A raridade pode ser alterada manualmente, mas convencionalmente
              acompanha o tier do mob (T1=Comum, T5=Lendario).
            </p>
          </div>
        </div>

        {/* Coluna direita — form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-col gap-4">
            <FormField
              label="Nome"
              name="name"
              type="text"
              value={name}
              onChange={setName}
              error={errors.name}
              required
            />
            <FormField
              label="Flavor text"
              name="flavorText"
              type="textarea"
              value={flavorText}
              onChange={setFlavorText}
              error={errors.flavorText}
              placeholder="Texto narrativo curto da carta"
              required
            />
            <FormField
              label="Raridade"
              name="rarity"
              type="select"
              value={rarity}
              onChange={setRarity}
              options={RARITY_OPTIONS}
            />
          </div>

          {/* Effects editor */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Efeitos</h3>
                <p className="text-[11px] text-gray-500">
                  STAT_FLAT e STAT_PERCENT sao aplicados em batalha (Fase 1).
                  TRIGGER e STATUS_RESIST sao inertes ate Fase 2.
                </p>
              </div>
              <button
                type="button"
                onClick={addEffect}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition cursor-pointer"
              >
                + Adicionar
              </button>
            </div>

            {effects.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">
                Sem efeitos. Clique em &quot;+ Adicionar&quot; para criar.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {effects.map((eff, i) => (
                  <EffectRow
                    key={i}
                    index={i}
                    effect={eff}
                    onChangeType={(t) => changeEffectType(i, t)}
                    onUpdate={(patch) => updateEffect(i, patch)}
                    onRemove={() => removeEffect(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/admin/cards"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EffectRow — uma linha de efeito com tipo + campos especificos
// ---------------------------------------------------------------------------

type EffectRowProps = {
  index: number;
  effect: Effect;
  onChangeType: (type: string) => void;
  onUpdate: (patch: Partial<Effect>) => void;
  onRemove: () => void;
};

function EffectRow({ index, effect, onChangeType, onUpdate, onRemove }: EffectRowProps) {
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
              onChange={(e) =>
                onUpdate({ stat: e.target.value } as Partial<StatPercent>)
              }
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
              onChange={(e) =>
                onUpdate({ status: e.target.value } as Partial<StatusResist>)
              }
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
        <>
          <div className="col-span-10 sm:col-span-7">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Trigger ID
            </label>
            <input
              type="text"
              value={effect.trigger}
              onChange={(e) =>
                onUpdate({ trigger: e.target.value } as Partial<Trigger>)
              }
              placeholder="ex: ON_LOW_HP"
              className={inputCls}
            />
          </div>
        </>
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
