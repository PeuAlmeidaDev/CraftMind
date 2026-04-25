"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../_components/toast";
import ConfirmModal from "../_components/confirm-modal";

type SkillInfo = {
  id: string;
  characterSkillId: string;
  skillId: string;
  name: string;
  tier: number;
  damageType: string;
  equipped: boolean;
  slotIndex: number | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  house: { name: string } | null;
  character: {
    id: string;
    level: number;
    characterSkills: Array<{
      id: string;
      skillId: string;
      equipped: boolean;
      slotIndex: number | null;
      skill: { id: string; name: string; tier: number; damageType: string };
    }>;
  } | null;
};

type AllSkill = { id: string; name: string; tier: number; damageType: string };

const DAMAGE_COLORS: Record<string, string> = {
  PHYSICAL: "text-red-400",
  MAGICAL: "text-blue-400",
  NONE: "text-emerald-400",
};

const DAMAGE_LABELS: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-500/20 text-gray-400",
  2: "bg-green-500/20 text-green-400",
  3: "bg-blue-500/20 text-blue-400",
};

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allSkills, setAllSkills] = useState<AllSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [addSkillUserId, setAddSkillUserId] = useState<string | null>(null);
  const [addSkillId, setAddSkillId] = useState("");
  const [addSkillSearch, setAddSkillSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; skillId: string; skillName: string } | null>(null);

  const fetchUsers = useCallback(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((res) => setUsers(res.data ?? []))
      .catch(() => showToast("Erro ao carregar usuarios", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
    fetch("/api/admin/skills")
      .then((r) => r.json())
      .then((res) => {
        setAllSkills(
          (res.data ?? []).map((s: AllSkill) => ({ id: s.id, name: s.name, tier: s.tier, damageType: s.damageType }))
        );
      })
      .catch(() => {});
  }, [fetchUsers]);

  function getUserSkills(user: UserRow): SkillInfo[] {
    if (!user.character) return [];
    return user.character.characterSkills.map((cs) => ({
      id: cs.id,
      characterSkillId: cs.id,
      skillId: cs.skillId,
      name: cs.skill.name,
      tier: cs.skill.tier,
      damageType: cs.skill.damageType,
      equipped: cs.equipped,
      slotIndex: cs.slotIndex,
    }));
  }

  function getAvailableSkills(user: UserRow): AllSkill[] {
    const ownedIds = new Set(getUserSkills(user).map((s) => s.skillId));
    return allSkills.filter((s) => !ownedIds.has(s.id));
  }

  async function handleAddSkill() {
    if (!addSkillUserId || !addSkillId) return;
    try {
      const res = await fetch(`/api/admin/users/${addSkillUserId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: addSkillId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao adicionar", "error");
        return;
      }
      showToast(`Skill adicionada: ${json.data.skillName}`, "success");
      setAddSkillId("");
      setAddSkillSearch("");
      fetchUsers();
    } catch {
      showToast("Erro de conexao", "error");
    }
  }

  async function handleRemoveSkill() {
    if (!removeTarget) return;
    try {
      const res = await fetch(
        `/api/admin/users/${removeTarget.userId}/skills?skillId=${removeTarget.skillId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao remover", "error");
        return;
      }
      showToast("Skill removida", "success");
      fetchUsers();
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setRemoveTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Usuarios ({users.length})</h2>

      {users.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Nenhum usuario encontrado</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const skills = getUserSkills(user);
            const isExpanded = expandedUser === user.id;
            const isAdding = addSkillUserId === user.id;
            const available = isAdding ? getAvailableSkills(user) : [];
            const filteredAvailable = available.filter((s) =>
              s.name.toLowerCase().includes(addSkillSearch.toLowerCase()),
            );

            return (
              <div
                key={user.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden"
              >
                {/* User header */}
                <button
                  type="button"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                      <span className="text-sm text-gray-500">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {user.house && (
                      <span className="text-[10px] text-gray-500 uppercase">{user.house.name}</span>
                    )}
                    {user.character && (
                      <span className="text-[10px] text-gray-400">Lv {user.character.level}</span>
                    )}
                    <span className="text-xs text-gray-500">{skills.length} skills</span>
                    <span className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      &#9660;
                    </span>
                  </div>
                </button>

                {/* Expanded: skills list */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)] p-4">
                    {!user.character ? (
                      <p className="text-xs text-gray-500">Sem personagem criado</p>
                    ) : (
                      <>
                        {/* Skill list */}
                        {skills.length === 0 ? (
                          <p className="text-xs text-gray-500 mb-3">Nenhuma skill desbloqueada</p>
                        ) : (
                          <div className="space-y-1.5 mb-3">
                            {skills.map((skill) => (
                              <div
                                key={skill.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)]/50"
                              >
                                <span className="text-sm text-white flex-1">{skill.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${TIER_COLORS[skill.tier] ?? TIER_COLORS[1]}`}>
                                  T{skill.tier}
                                </span>
                                <span className={`text-[10px] ${DAMAGE_COLORS[skill.damageType] ?? "text-gray-400"}`}>
                                  {DAMAGE_LABELS[skill.damageType] ?? skill.damageType}
                                </span>
                                {skill.equipped && (
                                  <span className="text-[10px] text-amber-400">Slot {skill.slotIndex}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setRemoveTarget({ userId: user.id, skillId: skill.skillId, skillName: skill.name })}
                                  className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer ml-1"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add skill */}
                        {isAdding ? (
                          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 p-3">
                            <input
                              type="text"
                              value={addSkillSearch}
                              onChange={(e) => setAddSkillSearch(e.target.value)}
                              placeholder="Buscar skill..."
                              autoFocus
                              className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent-primary)] mb-2"
                            />
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {filteredAvailable.length === 0 ? (
                                <p className="text-xs text-gray-500 py-2 text-center">
                                  {available.length === 0 ? "Usuario ja tem todas as skills" : "Nenhuma skill encontrada"}
                                </p>
                              ) : (
                                filteredAvailable.map((skill) => (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    onClick={() => {
                                      setAddSkillId(skill.id);
                                      // Auto-add
                                      fetch(`/api/admin/users/${user.id}/skills`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ skillId: skill.id }),
                                      })
                                        .then((r) => r.json())
                                        .then((json) => {
                                          if (json.data?.added) {
                                            showToast(`Skill adicionada: ${skill.name}`, "success");
                                            fetchUsers();
                                          } else {
                                            showToast(json.error ?? "Erro", "error");
                                          }
                                        })
                                        .catch(() => showToast("Erro de conexao", "error"));
                                    }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                                  >
                                    <span className="text-sm text-white flex-1">{skill.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${TIER_COLORS[skill.tier] ?? TIER_COLORS[1]}`}>
                                      T{skill.tier}
                                    </span>
                                    <span className={`text-[10px] ${DAMAGE_COLORS[skill.damageType] ?? "text-gray-400"}`}>
                                      {DAMAGE_LABELS[skill.damageType] ?? skill.damageType}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setAddSkillUserId(null); setAddSkillSearch(""); }}
                              className="mt-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                            >
                              Fechar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddSkillUserId(user.id)}
                            className="text-xs px-3 py-1.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition cursor-pointer"
                          >
                            + Adicionar Skill
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveSkill}
        title="Remover Skill"
        message={`Remover "${removeTarget?.skillName}" deste usuario? Se estiver equipada, sera desequipada.`}
      />
    </div>
  );
}
