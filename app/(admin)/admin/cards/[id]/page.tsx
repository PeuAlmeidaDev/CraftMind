"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../_components/toast";
import FormField from "../../_components/form-field";
import EffectRow, {
  type Effect,
  makeDefaultEffect,
} from "../_components/effect-row";

const RARITY_OPTIONS = [
  { value: "COMUM", label: "Comum" },
  { value: "INCOMUM", label: "Incomum" },
  { value: "RARO", label: "Raro" },
  { value: "EPICO", label: "Epico" },
  { value: "LENDARIO", label: "Lendario" },
];

type CardData = {
  id: string;
  mobId: string;
  name: string;
  flavorText: string;
  rarity: string;
  cardArtUrl: string | null;
  effects: Effect[];
  requiredStars: number;
  dropChance: number;
  mob: { id: string; name: string; tier: number; imageUrl: string | null };
};

const STARS_OPTIONS = [
  { value: "1", label: "1★ (encontros 1+)" },
  { value: "2", label: "2★ (encontros 2+)" },
  { value: "3", label: "3★ (apenas 3★)" },
];

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
  const [requiredStars, setRequiredStars] = useState<number>(1);
  const [dropChance, setDropChance] = useState<number>(5);

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
        setRequiredStars(data.requiredStars);
        setDropChance(data.dropChance);
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
    if (![1, 2, 3].includes(requiredStars)) {
      setErrors({ requiredStars: "Estrela deve ser 1, 2 ou 3" });
      return;
    }
    if (
      Number.isNaN(dropChance) ||
      dropChance < 0 ||
      dropChance > 100
    ) {
      setErrors({ dropChance: "Chance de drop deve estar entre 0 e 100" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          flavorText: flavorText.trim(),
          rarity,
          requiredStars,
          dropChance,
          effects,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "Erro ao salvar";
        if (res.status === 409) {
          setErrors({ requiredStars: msg });
        }
        showToast(msg, "error");
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
              accept="image/jpeg,image/png,image/webp,image/gif"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="requiredStars"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Estrela minima do encontro
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <select
                  id="requiredStars"
                  name="requiredStars"
                  value={String(requiredStars)}
                  onChange={(e) => setRequiredStars(Number(e.target.value))}
                  className={`w-full bg-[var(--bg-secondary)] border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer ${
                    errors.requiredStars
                      ? "border-red-500"
                      : "border-[var(--border-subtle)]"
                  }`}
                >
                  {STARS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.requiredStars && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.requiredStars}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  Variante so dropa em encontros &gt;= {requiredStars}★.
                </p>
              </div>

              <div>
                <label
                  htmlFor="dropChance"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Chance de drop (0-100)
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  id="dropChance"
                  name="dropChance"
                  type="number"
                  step={0.1}
                  min={0}
                  max={100}
                  value={Number.isFinite(dropChance) ? dropChance : 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDropChance(v === "" ? 0 : Number(v));
                  }}
                  className={`w-full bg-[var(--bg-secondary)] border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent-primary)] transition-colors ${
                    errors.dropChance
                      ? "border-red-500"
                      : "border-[var(--border-subtle)]"
                  }`}
                />
                {errors.dropChance && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.dropChance}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  Percentual rolado quando a variante e elegivel.
                </p>
              </div>
            </div>
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

