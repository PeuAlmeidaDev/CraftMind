"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "../_components/toast";
import ConfirmModal from "../_components/confirm-modal";

type SkillRow = {
  id: string;
  name: string;
  description: string;
  tier: number;
  cooldown: number;
  target: string;
  damageType: string;
  basePower: number;
  hits: number;
  accuracy: number;
};

const DAMAGE_LABELS: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

const TARGET_LABELS: Record<string, string> = {
  SELF: "Self",
  SINGLE_ALLY: "Aliado",
  ALL_ALLIES: "Todos Aliados",
  SINGLE_ENEMY: "Inimigo",
  ALL_ENEMIES: "Todos Inimigos",
  ALL: "Todos",
};

export default function AdminSkillsPage() {
  const { showToast } = useToast();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState("");
  const [filterDamage, setFilterDamage] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/skills")
      .then((r) => r.json())
      .then((res) => setSkills(res.data ?? []))
      .catch(() => showToast("Erro ao carregar skills", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (filterTier && s.tier !== Number(filterTier)) return false;
      if (filterDamage && s.damageType !== filterDamage) return false;
      if (filterTarget && s.target !== filterTarget) return false;
      return true;
    });
  }, [skills, filterTier, filterDamage, filterTarget]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/skills/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao deletar", "error");
        return;
      }
      const w = json.data?.warnings;
      const parts: string[] = [];
      if (w?.characterSkills > 0) parts.push(`${w.characterSkills} personagens`);
      if (w?.mobSkills > 0) parts.push(`${w.mobSkills} mobs`);
      if (w?.bossSkills > 0) parts.push(`${w.bossSkills} bosses`);
      const warning = parts.length > 0 ? ` (removida de ${parts.join(", ")})` : "";
      showToast(`Skill deletada${warning}`, "success");
      setSkills((prev) => prev.filter((s) => s.id !== deleteId));
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setDeleteId(null);
    }
  }

  const selectClass = "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Skills</h2>
        <Link
          href="/admin/skills/new"
          className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition"
        >
          Nova Skill
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className={selectClass}>
          <option value="">Tier: Todos</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select value={filterDamage} onChange={(e) => setFilterDamage(e.target.value)} className={selectClass}>
          <option value="">Tipo: Todos</option>
          <option value="PHYSICAL">Fisico</option>
          <option value="MAGICAL">Magico</option>
          <option value="NONE">Suporte</option>
        </select>
        <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} className={selectClass}>
          <option value="">Target: Todos</option>
          {Object.entries(TARGET_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Nenhuma skill encontrada</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)] text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Poder</th>
                <th className="px-4 py-3 font-medium">CD</th>
                <th className="px-4 py-3 font-medium">Acuracia</th>
                <th className="px-4 py-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill, idx) => (
                <tr
                  key={skill.id}
                  className={`border-t border-[var(--border-subtle)] ${idx % 2 === 1 ? "bg-[var(--bg-secondary)]/30" : ""}`}
                >
                  <td className="px-4 py-3 text-white font-medium">{skill.name}</td>
                  <td className="px-4 py-3 text-gray-300">{skill.tier}</td>
                  <td className="px-4 py-3 text-gray-300">{DAMAGE_LABELS[skill.damageType] ?? skill.damageType}</td>
                  <td className="px-4 py-3 text-gray-300">{TARGET_LABELS[skill.target] ?? skill.target}</td>
                  <td className="px-4 py-3 text-gray-300">{skill.basePower}</td>
                  <td className="px-4 py-3 text-gray-300">{skill.cooldown}</td>
                  <td className="px-4 py-3 text-gray-300">{skill.accuracy}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/skills/${skill.id}`}
                        className="text-xs px-2.5 py-1 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(skill.id)}
                        className="text-xs px-2.5 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer"
                      >
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Deletar Skill"
        message="Tem certeza? A skill sera removida de todos os mobs, bosses e personagens que a possuem."
      />
    </div>
  );
}
