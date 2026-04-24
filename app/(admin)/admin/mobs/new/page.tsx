"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/toast";
import FormField from "../../_components/form-field";
import ImageUpload from "../../_components/image-upload";
import SkillSlotSelect from "../../_components/skill-slot-select";

const AI_OPTIONS = [
  { value: "BALANCED", label: "Balanced" },
  { value: "AGGRESSIVE", label: "Aggressive" },
  { value: "DEFENSIVE", label: "Defensive" },
  { value: "TACTICAL", label: "Tactical" },
];

const TIER_OPTIONS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
  { value: "4", label: "Tier 4" },
  { value: "5", label: "Tier 5" },
];

type SkillOption = { id: string; name: string; tier: number; damageType: string };

export default function NewMobPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allSkills, setAllSkills] = useState<SkillOption[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("1");
  const [aiProfile, setAiProfile] = useState("BALANCED");
  const [physicalAtk, setPhysicalAtk] = useState("50");
  const [physicalDef, setPhysicalDef] = useState("50");
  const [magicAtk, setMagicAtk] = useState("50");
  const [magicDef, setMagicDef] = useState("50");
  const [hp, setHp] = useState("100");
  const [speed, setSpeed] = useState("50");
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);

  useEffect(() => {
    fetch("/api/admin/skills")
      .then((r) => r.json())
      .then((res) => {
        const skills = (res.data ?? []).map((s: SkillOption) => ({
          id: s.id, name: s.name, tier: s.tier, damageType: s.damageType,
        }));
        setAllSkills(skills);
      })
      .catch(() => {});
  }, []);

  function setSlot(index: number, skillId: string | null) {
    setSlots((prev) => prev.map((s, i) => (i === index ? skillId : s)));
  }

  function getDisabledIds(slotIndex: number): string[] {
    return slots.filter((s, i) => s !== null && i !== slotIndex) as string[];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) { setErrors({ name: "Nome obrigatorio" }); return; }
    if (!description.trim()) { setErrors({ description: "Descricao obrigatoria" }); return; }

    setSaving(true);
    try {
      // 1. Create mob
      const res = await fetch("/api/admin/mobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          tier: Number(tier),
          aiProfile,
          physicalAtk: Number(physicalAtk),
          physicalDef: Number(physicalDef),
          magicAtk: Number(magicAtk),
          magicDef: Number(magicDef),
          hp: Number(hp),
          speed: Number(speed),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.code === "DUPLICATE_NAME") {
          setErrors({ name: "Ja existe um mob com este nome" });
        } else {
          showToast(json.error ?? "Erro ao criar", "error");
        }
        return;
      }

      const mobId = json.data.id as string;

      // 2. Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const imgRes = await fetch(`/api/admin/mobs/${mobId}/image`, {
          method: "POST",
          body: formData,
        });
        if (!imgRes.ok) {
          showToast("Mob criado, mas erro no upload da imagem", "error");
        }
      }

      // 3. Save skills
      const skillEntries = slots
        .map((skillId, slotIndex) => (skillId ? { skillId, slotIndex } : null))
        .filter(Boolean);

      if (skillEntries.length > 0) {
        const skillRes = await fetch(`/api/admin/mobs/${mobId}/skills`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skills: skillEntries }),
        });
        if (!skillRes.ok) {
          showToast("Mob criado, mas erro ao salvar skills", "error");
        }
      }

      showToast("Mob criado com sucesso", "success");
      router.push("/admin/mobs");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-white mb-6">Novo Mob</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nome" name="name" type="text" value={name} onChange={setName} error={errors.name} required />
          <FormField label="Tier" name="tier" type="select" value={tier} onChange={setTier} options={TIER_OPTIONS} required />
          <div className="md:col-span-2">
            <FormField label="Descricao" name="description" type="textarea" value={description} onChange={setDescription} error={errors.description} required />
          </div>
          <FormField label="AI Profile" name="aiProfile" type="select" value={aiProfile} onChange={setAiProfile} options={AI_OPTIONS} required />
        </div>

        {/* Stats */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormField label="P. ATK" name="physicalAtk" type="number" value={physicalAtk} onChange={setPhysicalAtk} min={1} max={9999} />
            <FormField label="P. DEF" name="physicalDef" type="number" value={physicalDef} onChange={setPhysicalDef} min={1} max={9999} />
            <FormField label="M. ATK" name="magicAtk" type="number" value={magicAtk} onChange={setMagicAtk} min={1} max={9999} />
            <FormField label="M. DEF" name="magicDef" type="number" value={magicDef} onChange={setMagicDef} min={1} max={9999} />
            <FormField label="HP" name="hp" type="number" value={hp} onChange={setHp} min={1} max={9999} />
            <FormField label="Speed" name="speed" type="number" value={speed} onChange={setSpeed} min={1} max={9999} />
          </div>
        </div>

        {/* Image */}
        <ImageUpload onFileSelect={setImageFile} />

        {/* Skills */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Skills (4 slots)</h3>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <SkillSlotSelect
                key={i}
                slotIndex={i}
                skills={allSkills}
                selectedSkillId={slots[i]}
                onChange={(id) => setSlot(i, id)}
                disabledSkillIds={getDisabledIds(i)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "Criar Mob"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/mobs")}
            className="px-6 py-2.5 text-sm text-gray-400 border border-[var(--border-subtle)] rounded-lg hover:text-white transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
