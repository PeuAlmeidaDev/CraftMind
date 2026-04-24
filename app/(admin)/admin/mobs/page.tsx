"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "../_components/toast";
import ConfirmModal from "../_components/confirm-modal";

type MobSkillEntry = {
  id: string;
  skillId: string;
  slotIndex: number;
  skill: { id: string; name: string; tier: number; damageType: string };
};

type MobRow = {
  id: string;
  name: string;
  description: string;
  tier: number;
  aiProfile: string;
  imageUrl: string | null;
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
  skills: MobSkillEntry[];
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-500/20 text-gray-400",
  2: "bg-green-500/20 text-green-400",
  3: "bg-blue-500/20 text-blue-400",
  4: "bg-purple-500/20 text-purple-400",
  5: "bg-amber-500/20 text-amber-400",
};

export default function AdminMobsPage() {
  const { showToast } = useToast();
  const [mobs, setMobs] = useState<MobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState("");
  const [filterAi, setFilterAi] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/mobs")
      .then((r) => r.json())
      .then((res) => setMobs(res.data ?? []))
      .catch(() => showToast("Erro ao carregar mobs", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const filtered = useMemo(() => {
    return mobs.filter((m) => {
      if (filterTier && m.tier !== Number(filterTier)) return false;
      if (filterAi && m.aiProfile !== filterAi) return false;
      return true;
    });
  }, [mobs, filterTier, filterAi]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/mobs/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao deletar", "error");
        return;
      }
      showToast("Mob deletado", "success");
      setMobs((prev) => prev.filter((m) => m.id !== deleteId));
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
        <h2 className="text-xl font-bold text-white">Mobs</h2>
        <Link
          href="/admin/mobs/new"
          className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition"
        >
          Novo Mob
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className={selectClass}>
          <option value="">Tier: Todos</option>
          {[1, 2, 3, 4, 5].map((t) => (
            <option key={t} value={t}>Tier {t}</option>
          ))}
        </select>
        <select value={filterAi} onChange={(e) => setFilterAi(e.target.value)} className={selectClass}>
          <option value="">AI: Todos</option>
          <option value="AGGRESSIVE">Aggressive</option>
          <option value="DEFENSIVE">Defensive</option>
          <option value="TACTICAL">Tactical</option>
          <option value="BALANCED">Balanced</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Nenhum mob encontrado</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mob) => (
            <div
              key={mob.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                {mob.imageUrl ? (
                  <img
                    src={mob.imageUrl}
                    alt={mob.name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                    <span className="text-xl text-gray-500">{mob.name.charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{mob.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${TIER_COLORS[mob.tier] ?? TIER_COLORS[1]}`}>
                      T{mob.tier}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase">{mob.aiProfile}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                <p>ATK {mob.physicalAtk} / DEF {mob.physicalDef} / M.ATK {mob.magicAtk}</p>
                <p>M.DEF {mob.magicDef} / HP {mob.hp} / SPD {mob.speed}</p>
              </div>

              <p className="text-xs text-gray-500 mb-3">{mob.skills.length}/4 skills</p>

              <div className="flex gap-2">
                <Link
                  href={`/admin/mobs/${mob.id}`}
                  className="flex-1 text-center text-xs py-1.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteId(mob.id)}
                  className="flex-1 text-xs py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer"
                >
                  Deletar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Deletar Mob"
        message="Tem certeza? O mob e todas as suas skills serao removidos."
      />
    </div>
  );
}
