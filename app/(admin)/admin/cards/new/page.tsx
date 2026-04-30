"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

const TIER_TO_RARITY: Record<number, string> = {
  1: "COMUM",
  2: "INCOMUM",
  3: "RARO",
  4: "EPICO",
  5: "LENDARIO",
};

type MobOption = {
  id: string;
  name: string;
  tier: number;
  imageUrl: string | null;
};

type CardListItem = {
  id: string;
  mobId: string;
};

export default function NewCardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [mobs, setMobs] = useState<MobOption[]>([]);
  const [usedMobIds, setUsedMobIds] = useState<Set<string>>(new Set());

  const [mobId, setMobId] = useState("");
  const [name, setName] = useState("");
  const [flavorText, setFlavorText] = useState("");
  const [rarity, setRarity] = useState("COMUM");
  const [effects, setEffects] = useState<Effect[]>([
    { type: "STAT_FLAT", stat: "physicalAtk", value: 5 },
  ]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/mobs").then((r) => r.json()),
      fetch("/api/admin/cards").then((r) => r.json()),
    ])
      .then(([mobsRes, cardsRes]) => {
        const ms: MobOption[] = (mobsRes.data ?? []).map(
          (m: { id: string; name: string; tier: number; imageUrl: string | null }) => ({
            id: m.id,
            name: m.name,
            tier: m.tier,
            imageUrl: m.imageUrl,
          }),
        );
        setMobs(ms);
        const taken = new Set<string>(
          (cardsRes.data ?? []).map((c: CardListItem) => c.mobId),
        );
        setUsedMobIds(taken);
      })
      .catch(() => showToast("Erro ao carregar mobs", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  // Mobs disponiveis = sem cristal ainda. Auto-seleciona primeiro disponivel.
  const availableMobs = useMemo(
    () => mobs.filter((m) => !usedMobIds.has(m.id)),
    [mobs, usedMobIds],
  );

  useEffect(() => {
    if (!mobId && availableMobs.length > 0) {
      const first = availableMobs[0];
      setMobId(first.id);
      // Preenche raridade e nome sugeridos baseados no mob.
      setRarity(TIER_TO_RARITY[first.tier] ?? "COMUM");
      if (!name) setName(`Cristal do ${first.name}`);
    }
  }, [availableMobs, mobId, name]);

  const selectedMob = useMemo(
    () => mobs.find((m) => m.id === mobId) ?? null,
    [mobs, mobId],
  );

  function onMobChange(newId: string) {
    setMobId(newId);
    const mob = mobs.find((m) => m.id === newId);
    if (mob) {
      setRarity(TIER_TO_RARITY[mob.tier] ?? "COMUM");
      // Sobrescreve o nome sugerido apenas se o user nao customizou ainda
      // (heuristica: se ainda comeca com "Cristal do ").
      if (!name || name.startsWith("Cristal do ") || name.startsWith("Cristal da ")) {
        setName(`Cristal do ${mob.name}`);
      }
    }
  }

  function updateEffect(index: number, patch: Partial<Effect>) {
    setEffects((prev) =>
      prev.map((eff, i) => (i === index ? ({ ...eff, ...patch } as Effect) : eff)),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!mobId) {
      setErrors({ mobId: "Selecione um mob" });
      return;
    }
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
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobId,
          name: name.trim(),
          flavorText: flavorText.trim(),
          rarity,
          effects,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao criar", "error");
        if (json.details) console.error("Validation details:", json.details);
        return;
      }
      showToast("Cristal criado", "success");
      router.push(`/admin/cards/${json.data.id}`);
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

  if (availableMobs.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin/cards" className="text-gray-400 hover:text-white text-sm">
            ← Cristais
          </Link>
          <span className="text-gray-600">/</span>
          <h2 className="text-xl font-bold text-white">Novo cristal</h2>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
          <p className="text-gray-300 mb-2">Todos os mobs ja possuem cristal.</p>
          <p className="text-xs text-gray-500">
            No schema atual cada mob suporta apenas 1 cristal. Para criar
            variacoes (ex: cristal raro do mesmo mob com efeito extra) sera
            necessario remover a constraint <code>mobId @unique</code> no
            modelo <code>Card</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/cards" className="text-gray-400 hover:text-white text-sm">
          ← Cristais
        </Link>
        <span className="text-gray-600">/</span>
        <h2 className="text-xl font-bold text-white">Novo cristal</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Coluna esquerda — preview do mob selecionado */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
            <p className="text-xs text-gray-500 mb-2">Mob de origem</p>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--bg-secondary)]">
              {selectedMob?.imageUrl ? (
                <img
                  src={selectedMob.imageUrl}
                  alt={selectedMob.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-4xl text-gray-600">
                    {selectedMob?.name.charAt(0) ?? "?"}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-600 italic mt-2">
              A arte da carta podera ser feita upload depois de criada.
              Enquanto null, o bestiario usa a foto do mob.
            </p>
          </div>
        </div>

        {/* Coluna direita — form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Mob <span className="text-red-400">*</span>
              </label>
              <select
                value={mobId}
                onChange={(e) => onMobChange(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
              >
                {availableMobs.map((m) => (
                  <option key={m.id} value={m.id}>
                    T{m.tier} — {m.name}
                  </option>
                ))}
              </select>
              {errors.mobId && (
                <p className="text-red-400 text-xs mt-1">{errors.mobId}</p>
              )}
              <p className="text-[10px] text-gray-500 mt-1.5">
                Mostrando apenas mobs sem cristal. {usedMobIds.size} ja com
                cristal · {availableMobs.length} disponivel
                {availableMobs.length === 1 ? "" : "s"}.
              </p>
            </div>

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
                Sem efeitos. Clique em &quot;+ Adicionar&quot;.
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
              {saving ? "Criando..." : "Criar cristal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
