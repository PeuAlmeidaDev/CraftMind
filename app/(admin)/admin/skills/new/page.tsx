"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/toast";
import FormField from "../../_components/form-field";
import EffectEditor from "../../_components/effect-editor";
import MasteryEditor from "../../_components/mastery-editor";

const TARGET_OPTIONS = [
  { value: "SINGLE_ENEMY", label: "Inimigo" },
  { value: "ALL_ENEMIES", label: "Todos Inimigos" },
  { value: "SELF", label: "Self" },
  { value: "SINGLE_ALLY", label: "Aliado" },
  { value: "ALL_ALLIES", label: "Todos Aliados" },
  { value: "ALL", label: "Todos" },
];

const DAMAGE_OPTIONS = [
  { value: "PHYSICAL", label: "Fisico" },
  { value: "MAGICAL", label: "Magico" },
  { value: "NONE", label: "Suporte" },
];

const TIER_OPTIONS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
];

export default function NewSkillPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("1");
  const [cooldown, setCooldown] = useState("0");
  const [target, setTarget] = useState("SINGLE_ENEMY");
  const [damageType, setDamageType] = useState("PHYSICAL");
  const [basePower, setBasePower] = useState("0");
  const [hits, setHits] = useState("1");
  const [accuracy, setAccuracy] = useState("100");
  const [effects, setEffects] = useState("[]");
  const [mastery, setMastery] = useState("{}");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) { setErrors({ name: "Nome obrigatorio" }); return; }
    if (!description.trim()) { setErrors({ description: "Descricao obrigatoria" }); return; }

    let parsedEffects: unknown;
    let parsedMastery: unknown;
    try { parsedEffects = JSON.parse(effects); } catch { setErrors({ effects: "JSON invalido" }); return; }
    try { parsedMastery = JSON.parse(mastery); } catch { setErrors({ mastery: "JSON invalido" }); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          tier: Number(tier),
          cooldown: Number(cooldown),
          target,
          damageType,
          basePower: Number(basePower),
          hits: Number(hits),
          accuracy: Number(accuracy),
          effects: parsedEffects,
          mastery: parsedMastery,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.code === "DUPLICATE_NAME") {
          setErrors({ name: "Ja existe uma skill com este nome" });
        } else {
          showToast(json.error ?? "Erro ao criar", "error");
        }
        return;
      }

      showToast("Skill criada com sucesso", "success");
      router.push("/admin/skills");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-white mb-6">Nova Skill</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nome" name="name" type="text" value={name} onChange={setName} error={errors.name} required />
          <FormField label="Tier" name="tier" type="select" value={tier} onChange={setTier} options={TIER_OPTIONS} required />
          <div className="md:col-span-2">
            <FormField label="Descricao" name="description" type="textarea" value={description} onChange={setDescription} error={errors.description} required />
          </div>
          <FormField label="Tipo de Dano" name="damageType" type="select" value={damageType} onChange={setDamageType} options={DAMAGE_OPTIONS} required />
          <FormField label="Target" name="target" type="select" value={target} onChange={setTarget} options={TARGET_OPTIONS} required />
          <FormField label="Base Power" name="basePower" type="number" value={basePower} onChange={setBasePower} min={0} max={9999} />
          <FormField label="Cooldown" name="cooldown" type="number" value={cooldown} onChange={setCooldown} min={0} max={5} />
          <FormField label="Hits" name="hits" type="number" value={hits} onChange={setHits} min={1} max={5} />
          <FormField label="Acuracia" name="accuracy" type="number" value={accuracy} onChange={setAccuracy} min={1} max={100} />
        </div>

        <EffectEditor value={effects} onChange={setEffects} />
        <MasteryEditor value={mastery} onChange={setMastery} />

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Criar Skill"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/skills")}
            className="px-6 py-2.5 text-sm text-gray-400 border border-[var(--border-subtle)] rounded-lg hover:text-white transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
