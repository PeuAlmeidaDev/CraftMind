"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { initBattle, resolveTurn } from "@/lib/battle";
import type {
  BattleState,
  TurnAction,
  EquippedSkill,
  BaseStats,
  TurnLogEntry,
} from "@/lib/battle";
import type { Skill } from "@/types/skill";

// ---------------------------------------------------------------------------
// Dados hardcoded
// ---------------------------------------------------------------------------

const P1_STATS: BaseStats = {
  physicalAtk: 25,
  physicalDef: 18,
  magicAtk: 20,
  magicDef: 16,
  hp: 250,
  speed: 16,
};

const P2_STATS: BaseStats = {
  physicalAtk: 20,
  physicalDef: 15,
  magicAtk: 28,
  magicDef: 20,
  hp: 220,
  speed: 14,
};

const PLAYER_NAMES: Record<string, string> = {
  "player-1": "Guerreiro",
  "player-2": "Mago",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBattleFromLoadout(allSkills: Skill[], p1Ids: string[], p2Ids: string[]): BattleState {
  const makeEquipped = (ids: string[]): EquippedSkill[] =>
    ids.map((id, i) => {
      const skill = allSkills.find((s) => s.id === id)!;
      return { skillId: id, slotIndex: i, skill };
    });
  return initBattle({
    battleId: crypto.randomUUID(),
    player1: {
      userId: "player-1",
      characterId: "char-1",
      stats: P1_STATS,
      skills: makeEquipped(p1Ids),
    },
    player2: {
      userId: "player-2",
      characterId: "char-2",
      stats: P2_STATS,
      skills: makeEquipped(p2Ids),
    },
  });
}

function hpPercent(current: number, max: number): number {
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function hpColor(percent: number): string {
  if (percent > 60) return "#10b981";
  if (percent > 30) return "#eab308";
  return "#ef4444";
}

function damageTypeColor(dt: string): { border: string; bg: string; text: string } {
  if (dt === "PHYSICAL") return { border: "#ef4444", bg: "rgba(239,68,68,0.08)", text: "#fca5a5" };
  if (dt === "MAGICAL") return { border: "#3b82f6", bg: "rgba(59,130,246,0.08)", text: "#93c5fd" };
  return { border: "#10b981", bg: "rgba(16,185,129,0.08)", text: "#6ee7b7" };
}

function statusColor(status: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    BURN: { bg: "rgba(249,115,22,0.2)", text: "#fb923c" },
    POISON: { bg: "rgba(168,85,247,0.2)", text: "#c084fc" },
    FROZEN: { bg: "rgba(56,189,248,0.2)", text: "#7dd3fc" },
    STUN: { bg: "rgba(234,179,8,0.2)", text: "#fde047" },
    SLOW: { bg: "rgba(156,163,175,0.2)", text: "#9ca3af" },
  };
  return map[status] ?? { bg: "rgba(156,163,175,0.2)", text: "#9ca3af" };
}

const STAT_LABELS: Record<string, string> = {
  physicalAtk: "ATK",
  physicalDef: "DEF",
  magicAtk: "MATK",
  magicDef: "MDEF",
  hp: "HP",
  speed: "SPD",
};

function formatLogMessage(entry: TurnLogEntry): string {
  return entry.message
    .replace(/player-1/g, "Guerreiro")
    .replace(/player-2/g, "Mago");
}

function logPhaseColor(phase: string): string {
  if (phase === "DAMAGE" || phase === "DEATH") return "#ef4444";
  if (phase === "HEAL" || phase.includes("HEAL")) return "#10b981";
  if (phase === "MISS") return "#6b7280";
  if (phase === "STATUS_DAMAGE" || phase === "STATUS" || phase.includes("STATUS")) return "#f97316";
  if (phase === "BUFF" || phase.includes("BUFF")) return "#3b82f6";
  if (phase === "COOLDOWN") return "#6b7280";
  return "#9ca3af";
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = hpPercent(current, max);
  const color = hpColor(pct);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
        <span style={{ color: "#9ca3af" }}>HP</span>
        <span style={{ color, fontFamily: "monospace" }}>
          {current} / {max}
        </span>
      </div>
      <div style={{
        height: 14,
        width: "100%",
        borderRadius: 9999,
        backgroundColor: "#0a0a0f",
        border: "1px solid #2a2a3e",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: color,
          borderRadius: 9999,
          transition: "all 0.5s ease",
        }} />
      </div>
    </div>
  );
}

function StatBlock({ stats }: { stats: BaseStats }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "4px 12px",
      fontSize: 11,
    }}>
      {(Object.keys(stats) as (keyof BaseStats)[]).map((key) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
          <span style={{ color: "#6b7280" }}>{STAT_LABELS[key]}</span>
          <span style={{ color: "#d1d5db", fontFamily: "monospace", fontWeight: 600 }}>{stats[key]}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadges({ effects }: { effects: { status: string; remainingTurns: number }[] }) {
  if (effects.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {effects.map((e, i) => {
        const c = statusColor(e.status);
        return (
          <span
            key={`${e.status}-${i}`}
            style={{
              backgroundColor: c.bg,
              color: c.text,
              border: `1px solid ${c.text}33`,
              borderRadius: 9999,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {e.status} ({e.remainingTurns})
          </span>
        );
      })}
    </div>
  );
}

function SkillTooltip({ skill }: { skill: Skill }) {
  const dtc = damageTypeColor(skill.damageType);
  return (
    <div style={{
      position: "absolute",
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginBottom: 8,
      width: 240,
      backgroundColor: "#1a1a2e",
      border: "1px solid #2a2a3e",
      borderRadius: 10,
      padding: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      zIndex: 50,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{skill.name}</p>
      <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, marginBottom: 8 }}>{skill.description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11 }}>
        <div>
          <span style={{ color: "#6b7280" }}>Tipo: </span>
          <span style={{ color: dtc.text }}>
            {skill.damageType === "PHYSICAL" ? "Fisico" : skill.damageType === "MAGICAL" ? "Magico" : "Suporte"}
          </span>
        </div>
        {skill.basePower > 0 && (
          <div><span style={{ color: "#6b7280" }}>Poder: </span><span style={{ color: "#d1d5db" }}>{skill.basePower}</span></div>
        )}
        <div><span style={{ color: "#6b7280" }}>Precisao: </span><span style={{ color: "#d1d5db" }}>{skill.accuracy}%</span></div>
        <div>
          <span style={{ color: "#6b7280" }}>Cooldown: </span>
          <span style={{ color: "#d1d5db" }}>{skill.cooldown === 0 ? "Nenhum" : `${skill.cooldown} turno(s)`}</span>
        </div>
        {skill.effects.length > 0 && (
          <div style={{ borderTop: "1px solid #2a2a3e", paddingTop: 4, marginTop: 2 }}>
            <span style={{ color: "#6b7280" }}>Efeitos:</span>
            {skill.effects.map((e, i) => (
              <p key={i} style={{ color: "#9ca3af", marginTop: 2 }}>
                {e.type === "STATUS" && `${e.status} (${e.chance}% chance, ${e.duration}t)`}
                {e.type === "RECOIL" && `Recuo: ${e.percentOfDamage}% do dano`}
                {e.type === "HEAL" && `Cura: ${e.percent}% HP`}
              </p>
            ))}
          </div>
        )}
      </div>
      {/* Arrow */}
      <div style={{
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "6px solid #2a2a3e",
      }} />
    </div>
  );
}

function SkillButton({
  skill,
  cooldown,
  selected,
  disabled,
  onClick,
}: {
  skill: Skill;
  cooldown: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const onCooldown = cooldown > 0;
  const isDisabled = disabled || onCooldown;
  const dtc = damageTypeColor(skill.damageType);

  return (
    <div style={{ position: "relative" }}>
      {hovered && !isDisabled && <SkillTooltip skill={skill} />}
      <button
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isDisabled}
        style={{
          position: "relative",
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: 10,
          border: `2px solid ${selected ? "#facc15" : dtc.border}`,
          backgroundColor: selected ? "rgba(250,204,21,0.06)" : dtc.bg,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.35 : 1,
          transform: selected ? "scale(1.03)" : "scale(1)",
          boxShadow: selected ? `0 0 16px ${dtc.border}44` : "none",
          transition: "all 0.2s ease",
          outline: "none",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{skill.name}</p>
        <p style={{ fontSize: 10, color: "#6b7280", margin: "2px 0 0" }}>
          {skill.damageType === "NONE" ? "Suporte" : skill.damageType} {skill.basePower > 0 ? `| ${skill.basePower} PWR` : ""} | {skill.accuracy}%
        </p>
        {onCooldown && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: "rgba(0,0,0,0.65)",
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#9ca3af" }}>{cooldown}t</span>
          </div>
        )}
      </button>
    </div>
  );
}

function LogPanel({ entries }: { entries: TurnLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  const reversed = [...entries].reverse();

  return (
    <div
      ref={scrollRef}
      style={{
        maxHeight: 280,
        overflowY: "auto",
        borderRadius: 10,
        border: "1px solid #2a2a3e",
        backgroundColor: "rgba(10,10,15,0.8)",
        padding: 14,
      }}
    >
      {reversed.length === 0 ? (
        <p style={{ textAlign: "center", fontSize: 12, color: "#4b5563" }}>
          Selecione as skills para iniciar o combate.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {reversed.map((entry, i) => (
            <p key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "#9ca3af", margin: 0 }}>
              <span style={{ fontFamily: "monospace", color: "#4b5563", marginRight: 4 }}>T{entry.turn}</span>
              <span style={{ color: logPhaseColor(entry.phase), fontWeight: 600, marginRight: 4 }}>[{entry.phase}]</span>
              {formatLogMessage(entry)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function VictoryOverlay({
  winnerId,
  onNewBattle,
}: {
  winnerId: string | null;
  onNewBattle: () => void;
}) {
  const name = winnerId ? (PLAYER_NAMES[winnerId] ?? winnerId) : null;
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        borderRadius: 16,
        border: "1px solid #2a2a3e",
        backgroundColor: "#1a1a2e",
        padding: "40px 56px",
        boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 48 }}>&#9876;</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: -0.5 }}>
          {name ? `${name} venceu!` : "Empate!"}
        </h2>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>A batalha terminou.</p>
        <button
          onClick={onNewBattle}
          style={{
            padding: "12px 32px",
            borderRadius: 10,
            border: "none",
            backgroundColor: "#7c3aed",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#6d28d9")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#7c3aed")}
        >
          Nova Batalha
        </button>
      </div>
    </div>
  );
}

function PlayerPanel({
  label,
  accentColor,
  player,
  skills,
  selectedSkill,
  isActive,
  onSkillClick,
  battleFinished,
}: {
  label: string;
  accentColor: string;
  player: BattleState["players"][number];
  skills: Skill[];
  selectedSkill: string | null;
  isActive: boolean;
  onSkillClick: (skillId: string) => void;
  battleFinished: boolean;
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: `2px solid ${isActive ? "#7c3aed" : "#2a2a3e"}`,
      backgroundColor: "#1a1a2e",
      padding: 20,
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 0 24px rgba(124,58,237,0.15)" : "none",
    }}>
      {/* Name + turn indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: accentColor, margin: 0 }}>{label}</h2>
        {isActive && (
          <span style={{
            backgroundColor: "rgba(124,58,237,0.15)",
            color: "#7c3aed",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
            animation: "pulse 2s infinite",
          }}>
            Escolha
          </span>
        )}
      </div>

      {/* HP */}
      <HpBar current={player.currentHp} max={player.baseStats.hp} />

      {/* Status effects */}
      <div style={{ marginTop: 8, minHeight: 24 }}>
        <StatusBadges effects={player.statusEffects} />
      </div>

      {/* Stats */}
      <div style={{
        marginTop: 12,
        borderRadius: 8,
        border: "1px solid #2a2a3e",
        backgroundColor: "#13131a",
        padding: 10,
      }}>
        <StatBlock stats={player.baseStats} />
      </div>

      {/* Skills */}
      <div style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}>
        {skills.map((skill) => {
          const cd = player.cooldowns[skill.id] ?? 0;
          return (
            <SkillButton
              key={skill.id}
              skill={skill}
              cooldown={cd}
              selected={selectedSkill === skill.id}
              disabled={!isActive || battleFinished}
              onClick={() => onSkillClick(skill.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loadout Selection Components
// ---------------------------------------------------------------------------

function LoadoutSkillCard({
  skill,
  isSelected,
  slotNumber,
  isDisabled,
  accentColor,
  dtc,
  onToggle,
}: {
  skill: Skill;
  isSelected: boolean;
  slotNumber: number | null;
  isDisabled: boolean;
  accentColor: string;
  dtc: { border: string; bg: string; text: string };
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {hovered && <SkillTooltip skill={skill} />}
      <button
        onClick={isDisabled ? undefined : onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isDisabled}
        style={{
          position: "relative",
          width: "100%",
          textAlign: "left",
          padding: "8px 10px",
          borderRadius: 8,
          border: `2px solid ${isSelected ? accentColor : dtc.border + "66"}`,
          backgroundColor: isSelected ? accentColor + "15" : dtc.bg,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.35 : 1,
          transition: "all 0.15s ease",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>{skill.name}</p>
          {slotNumber !== null && (
            <span style={{
              backgroundColor: accentColor,
              color: "#fff",
              borderRadius: 9999,
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {slotNumber}
            </span>
          )}
        </div>
        <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 0" }}>
          {skill.damageType === "NONE" ? "SUP" : skill.damageType === "PHYSICAL" ? "PHY" : "MAG"}
          {skill.basePower > 0 ? ` ${skill.basePower}` : ""} | ACC {skill.accuracy}%
          {skill.cooldown > 0 ? ` | CD ${skill.cooldown}` : ""}
        </p>
      </button>
    </div>
  );
}

function LoadoutSelector({
  skills,
  selectedIds,
  onToggle,
  playerName,
  accentColor,
}: {
  skills: Skill[];
  selectedIds: string[];
  onToggle: (skillId: string) => void;
  playerName: string;
  accentColor: string;
}) {
  const tiers = [1, 2, 3];
  const isFull = selectedIds.length >= 4;

  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: accentColor, marginBottom: 12 }}>
        {playerName} — Loadout ({selectedIds.length}/4)
      </h3>
      {tiers.map((tier) => {
        const tierSkills = skills.filter((s) => s.tier === tier);
        if (tierSkills.length === 0) return null;
        return (
          <div key={tier} style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Tier {tier}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {tierSkills.map((skill) => {
                const selectedIndex = selectedIds.indexOf(skill.id);
                const isSelected = selectedIndex !== -1;
                const isDisabled = !isSelected && isFull;
                const dtc = damageTypeColor(skill.damageType);
                return (
                  <LoadoutSkillCard
                    key={skill.id}
                    skill={skill}
                    isSelected={isSelected}
                    slotNumber={isSelected ? selectedIndex + 1 : null}
                    isDisabled={isDisabled}
                    accentColor={accentColor}
                    dtc={dtc}
                    onToggle={() => onToggle(skill.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BattleTestPage() {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [p1Loadout, setP1Loadout] = useState<string[]>([]);
  const [p2Loadout, setP2Loadout] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loadout" | "battle">("loadout");
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [p1Skill, setP1Skill] = useState<string | null>(null);
  const [turnLog, setTurnLog] = useState<TurnLogEntry[]>([]);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((json: { data: Skill[] }) => { setAllSkills(json.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleP1 = useCallback((id: string) => {
    setP1Loadout((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  }, []);

  const toggleP2 = useCallback((id: string) => {
    setP2Loadout((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  }, []);

  const startBattle = useCallback(() => {
    const state = createBattleFromLoadout(allSkills, p1Loadout, p2Loadout);
    setBattle(state);
    setP1Skill(null);
    setTurnLog([]);
    setPhase("battle");
  }, [allSkills, p1Loadout, p2Loadout]);

  const backToLoadout = useCallback(() => {
    setBattle(null);
    setP1Skill(null);
    setTurnLog([]);
    setPhase("loadout");
  }, []);

  const handleNewBattle = useCallback(() => {
    const state = createBattleFromLoadout(allSkills, p1Loadout, p2Loadout);
    setBattle(state);
    setP1Skill(null);
    setTurnLog([]);
  }, [allSkills, p1Loadout, p2Loadout]);

  const handleP1Select = useCallback(
    (skillId: string) => {
      if (!battle || battle.status === "FINISHED") return;
      setP1Skill((prev) => (prev === skillId ? null : skillId));
    },
    [battle]
  );

  const handleP2Select = useCallback(
    (skillId: string) => {
      if (!battle || battle.status === "FINISHED" || p1Skill === null) return;

      const actions: [TurnAction, TurnAction] = [
        { playerId: "player-1", skillId: p1Skill },
        { playerId: "player-2", skillId: skillId },
      ];

      const result = resolveTurn(battle, actions);
      setBattle(result.state);
      setTurnLog((prev) => [...prev, ...result.events]);
      setP1Skill(null);
    },
    [battle, p1Skill]
  );

  const p1Skills = p1Loadout.map((id) => allSkills.find((s) => s.id === id)!);
  const p2Skills = p2Loadout.map((id) => allSkills.find((s) => s.id === id)!);

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#e5e7eb",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ fontSize: 16, color: "#6b7280" }}>Carregando skills...</p>
      </div>
    );
  }

  // Loadout phase
  if (phase === "loadout") {
    const canStart = p1Loadout.length === 4 && p2Loadout.length === 4;
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#e5e7eb",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>
              <span style={{ color: "#7c3aed" }}>Craft</span> Mind{" "}
              <span style={{ color: "#6b7280", fontWeight: 400 }}>/ Selecao de Loadout</span>
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              Cada jogador deve escolher 4 skills para a batalha.
            </p>
          </div>

          {/* Loadout selectors side by side */}
          <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
            <LoadoutSelector
              skills={allSkills}
              selectedIds={p1Loadout}
              onToggle={toggleP1}
              playerName="Guerreiro"
              accentColor="#10b981"
            />
            <LoadoutSelector
              skills={allSkills}
              selectedIds={p2Loadout}
              onToggle={toggleP2}
              playerName="Mago"
              accentColor="#3b82f6"
            />
          </div>

          {/* Start battle button */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={canStart ? startBattle : undefined}
              disabled={!canStart}
              style={{
                padding: "14px 40px",
                borderRadius: 10,
                border: "none",
                backgroundColor: canStart ? "#7c3aed" : "#2a2a3e",
                color: canStart ? "#fff" : "#4b5563",
                fontSize: 15,
                fontWeight: 700,
                cursor: canStart ? "pointer" : "not-allowed",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => { if (canStart) e.currentTarget.style.backgroundColor = "#6d28d9"; }}
              onMouseLeave={(e) => { if (canStart) e.currentTarget.style.backgroundColor = "#7c3aed"; }}
            >
              Iniciar Batalha
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Battle phase
  if (!battle) return null;

  const p1 = battle.players[0];
  const p2 = battle.players[1];
  const isP1Turn = p1Skill === null && battle.status === "IN_PROGRESS";
  const isP2Turn = p1Skill !== null && battle.status === "IN_PROGRESS";

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0a0a0f",
      color: "#e5e7eb",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Victory overlay */}
      {battle.status === "FINISHED" && (
        <VictoryOverlay winnerId={battle.winnerId} onNewBattle={handleNewBattle} />
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>
            <span style={{ color: "#7c3aed" }}>Craft</span> Mind{" "}
            <span style={{ color: "#6b7280", fontWeight: 400 }}>/ Teste de Batalha</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              backgroundColor: "rgba(124,58,237,0.15)",
              color: "#7c3aed",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
            }}>
              Turno {battle.turnNumber}
            </span>
            <button
              onClick={backToLoadout}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid #2a2a3e",
                backgroundColor: "transparent",
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)";
                e.currentTarget.style.color = "#7c3aed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a3e";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              Voltar ao Loadout
            </button>
            <button
              onClick={handleNewBattle}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid #2a2a3e",
                backgroundColor: "transparent",
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)";
                e.currentTarget.style.color = "#7c3aed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a3e";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              Reiniciar
            </button>
          </div>
        </div>

        {/* Turn indicator */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          {battle.status === "IN_PROGRESS" && (
            <p style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", margin: 0 }}>
              {isP1Turn ? (
                <>Vez do <span style={{ color: "#10b981", fontWeight: 700 }}>Guerreiro</span> escolher</>
              ) : (
                <>Vez do <span style={{ color: "#3b82f6", fontWeight: 700 }}>Mago</span> escolher</>
              )}
            </p>
          )}
        </div>

        {/* Battle arena */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <PlayerPanel
            label="Guerreiro"
            accentColor="#10b981"
            player={p1}
            skills={p1Skills}
            selectedSkill={p1Skill}
            isActive={isP1Turn}
            onSkillClick={handleP1Select}
            battleFinished={battle.status === "FINISHED"}
          />
          <PlayerPanel
            label="Mago"
            accentColor="#3b82f6"
            player={p2}
            skills={p2Skills}
            selectedSkill={null}
            isActive={isP2Turn}
            onSkillClick={handleP2Select}
            battleFinished={battle.status === "FINISHED"}
          />
        </div>

        {/* Battle log */}
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", marginBottom: 8 }}>Log de Batalha</h2>
          <LogPanel entries={turnLog} />
        </div>
      </div>

      {/* Pulse animation for "Escolha" badge */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
