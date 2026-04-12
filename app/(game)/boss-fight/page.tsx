"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Socket } from "socket.io-client";
import { useBossQueue } from "../_hooks/useBossQueue";
import CoopBattleArena from "./_components/CoopBattleArena";
import CoopBattleResult from "./_components/CoopBattleResult";
import type { TeamPlayerInfo } from "./_components/TeamPanel";
import type { CoopAvailableSkill } from "./_components/CoopSkillBar";
import type { TurnLogEntry, BaseStats, ActiveStatusEffect, PlayerState } from "@/lib/battle/types";

// ---------------------------------------------------------------------------
// Types — sanitized state from server
// ---------------------------------------------------------------------------

type SanitizedBossState = {
  playerId: string;
  baseStats: BaseStats;
  currentHp: number;
  statusEffects: ActiveStatusEffect[];
};

type SanitizedCoopState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[];
  boss: SanitizedBossState;
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerId: string | null;
  bossName: string;
  playerNames: Record<string, string>;
};

type BattlePhase = "LOADING" | "BATTLE" | "RESULT";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BossFightPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleIdParam = searchParams.get("battleId");
  const { getSocket: getQueueSocket } = useBossQueue();
  const bossNameParam = searchParams.get("bossName");

  const socketRef = useRef<Socket | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase
  const [phase, setPhase] = useState<BattlePhase>("LOADING");

  // Battle state
  const [boss, setBoss] = useState<SanitizedBossState | null>(null);
  const [bossName, setBossName] = useState(bossNameParam ?? "Boss");
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<PlayerState[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [turnNumber, setTurnNumber] = useState(1);
  const [events, setEvents] = useState<TurnLogEntry[]>([]);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(30);
  const [actedPlayers, setActedPlayers] = useState<Set<string>>(new Set());
  const [canAct, setCanAct] = useState(false);
  const [battleResult, setBattleResult] = useState<"VICTORY" | "DEFEAT" | null>(null);
  const [expGained, setExpGained] = useState(0);
  const [essenceGained, setEssenceGained] = useState(0);
  const [levelsGained, setLevelsGained] = useState(0);
  const [bossIsHit, setBossIsHit] = useState(false);
  const [playerName, setPlayerName] = useState("Voce");

  // Track previous events length for hit detection
  const prevEventsLengthRef = useRef(0);

  // -------------------------------------------------------------------------
  // Redirect if no battleId
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!battleIdParam) {
      router.push("/dashboard");
    }
  }, [battleIdParam, router]);

  // -------------------------------------------------------------------------
  // Fetch player profile for name
  // -------------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ data: { id: string; name: string } }>;
      })
      .then((json) => {
        if (json) {
          setCurrentPlayerId(json.data.id);
          setPlayerName(json.data.name);
        }
      })
      .catch(() => {
        // Network error — continue without profile
      });
  }, []);

  // -------------------------------------------------------------------------
  // Re-evaluate canAct when currentPlayerId is set (profile loads after state)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentPlayerId || team.length === 0) return;
    const me = team.find((p) => p.playerId === currentPlayerId);
    if (me && me.currentHp > 0 && phase === "BATTLE") {
      setCanAct(true);
    }
  }, [currentPlayerId, team, phase]);

  // -------------------------------------------------------------------------
  // Turn timer
  // -------------------------------------------------------------------------

  const startTurnTimer = useCallback(() => {
    if (turnTimerRef.current !== null) {
      clearInterval(turnTimerRef.current);
    }
    setTurnTimeRemaining(30);

    turnTimerRef.current = setInterval(() => {
      setTurnTimeRemaining((prev) => {
        if (prev <= 1) {
          if (turnTimerRef.current !== null) {
            clearInterval(turnTimerRef.current);
            turnTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTurnTimer = useCallback(() => {
    if (turnTimerRef.current !== null) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Boss hit animation
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (events.length <= prevEventsLengthRef.current) {
      prevEventsLengthRef.current = events.length;
      return;
    }

    const newEntries = events.slice(prevEventsLengthRef.current);
    prevEventsLengthRef.current = events.length;

    const bossHit = newEntries.some(
      (e) => e.targetId === boss?.playerId && e.damage !== undefined && e.damage > 0
    );

    if (bossHit) {
      setBossIsHit(true);
      const timer = setTimeout(() => setBossIsHit(false), 500);
      return () => clearTimeout(timer);
    }
  }, [events, boss?.playerId]);

  // -------------------------------------------------------------------------
  // Socket connection
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!battleIdParam) return;

    // Reuse the socket from useBossQueue — it's already authenticated and in the battle room
    const socket = getQueueSocket();
    if (!socket || !socket.connected) {
      console.error("[BossFight] No active socket from queue — cannot join battle");
      return;
    }

    socketRef.current = socket;

    // --- boss:battle:state — turn result / initial state (via request-state) ---

    const handleBattleState = (data: { state: SanitizedCoopState; events: TurnLogEntry[] }) => {
      const { state, events: turnEvents } = data;
      setBoss(state.boss);
      setTeam(state.team);
      if (state.bossName) setBossName(state.bossName);
      if (state.playerNames) setPlayerNames(state.playerNames);
      setTurnNumber(state.turnNumber);
      setEvents((prev) => [...prev, ...turnEvents]);
      setActedPlayers(new Set());

      if (state.status === "IN_PROGRESS") {
        setCurrentPlayerId((pid) => {
          const me = state.team.find((p) => p.playerId === pid);
          setCanAct(!!me && me.currentHp > 0);
          return pid;
        });
        startTurnTimer();
      }

      setPhase((prev) => (prev === "LOADING" ? "BATTLE" : prev));
    };

    // --- boss:action:received — teammate acted ---

    const handleActionReceived = (data: { playerId: string; total: number; expected: number }) => {
      setActedPlayers((prev) => {
        const next = new Set(prev);
        next.add(data.playerId);
        return next;
      });
    };

    // --- boss:battle:end — battle finished ---

    const handleBattleEnd = (data: {
      result: "VICTORY" | "DEFEAT";
      winnerId: string | null;
      expGained?: number;
      essenceGained?: number;
      levelsGained?: number;
    }) => {
      stopTurnTimer();
      setBattleResult(data.result);
      setExpGained(data.expGained ?? 0);
      setEssenceGained(data.essenceGained ?? (data.result === "VICTORY" ? 1 : 0));
      setLevelsGained(data.levelsGained ?? 0);
      setCanAct(false);
      setPhase("RESULT");
    };

    const handleError = (data: { message: string }) => {
      console.error("[BossFight] Error:", data.message);
    };

    socket.on("boss:battle:state", handleBattleState);
    socket.on("boss:action:received", handleActionReceived);
    socket.on("boss:battle:end", handleBattleEnd);
    socket.on("boss:battle:error", handleError);

    // Request current state from server (battle may have already started)
    socket.emit("boss:battle:request-state");

    return () => {
      stopTurnTimer();
      // Remove only battle-specific listeners, don't disconnect (queue hook owns the socket)
      socket.off("boss:battle:state", handleBattleState);
      socket.off("boss:action:received", handleActionReceived);
      socket.off("boss:battle:end", handleBattleEnd);
      socket.off("boss:battle:error", handleError);
      socketRef.current = null;
    };
  }, [battleIdParam, getQueueSocket, startTurnTimer, stopTurnTimer]);

  // -------------------------------------------------------------------------
  // Action handler
  // -------------------------------------------------------------------------

  const handleSkillUse = useCallback(
    (skillId: string, targetId?: string) => {
      const socket = socketRef.current;
      if (!socket || !battleIdParam) return;

      socket.emit("boss:action", {
        battleId: battleIdParam,
        skillId,
        targetId: targetId ?? undefined,
      });

      setCanAct(false);
    },
    [battleIdParam]
  );

  const handleSkipTurn = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !battleIdParam) return;

    socket.emit("boss:action", {
      battleId: battleIdParam,
      skillId: null,
    });

    setCanAct(false);
  }, [battleIdParam]);

  // -------------------------------------------------------------------------
  // Build team info for TeamPanel
  // -------------------------------------------------------------------------

  const teamPlayerInfo: TeamPlayerInfo[] = team.map((p, idx) => ({
    playerId: p.playerId,
    name: p.playerId === currentPlayerId ? playerName : (playerNames[p.playerId] ?? `Jogador ${idx + 1}`),
    currentHp: p.currentHp,
    maxHp: p.baseStats.hp,
    statusEffects: p.statusEffects.map((se) => ({
      status: se.status,
      remainingTurns: se.remainingTurns,
    })),
    isAlive: p.currentHp > 0,
  }));

  // -------------------------------------------------------------------------
  // Derive available skills for the current player
  // -------------------------------------------------------------------------

  const currentPlayer = team.find((p) => p.playerId === currentPlayerId);
  const availableSkills: CoopAvailableSkill[] = currentPlayer
    ? currentPlayer.equippedSkills.map((es) => ({
        skillId: es.skillId,
        slotIndex: es.slotIndex,
        name: es.skill.name,
        basePower: es.skill.basePower,
        damageType: es.skill.damageType,
        target: es.skill.target,
        cooldown: currentPlayer.cooldowns[es.skillId] ?? 0,
        accuracy: es.skill.accuracy,
      }))
    : [];

  // -------------------------------------------------------------------------
  // Build teammates list for CoopSkillBar (SINGLE_ALLY targeting)
  // -------------------------------------------------------------------------

  const teammates = teamPlayerInfo.map((t) => ({
    playerId: t.playerId,
    name: t.name,
    isAlive: t.isAlive,
  }));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!battleIdParam) return null;

  if (phase === "LOADING") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Conectando a batalha...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {boss && (
        <CoopBattleArena
          boss={{
            name: bossName,
            currentHp: boss.currentHp,
            maxHp: boss.baseStats.hp,
            statusEffects: boss.statusEffects.map((se) => ({
              status: se.status,
              remainingTurns: se.remainingTurns,
            })),
          }}
          team={teamPlayerInfo}
          events={events}
          turnNumber={turnNumber}
          turnTimeRemaining={turnTimeRemaining}
          actedPlayers={actedPlayers}
          currentPlayerId={currentPlayerId}
          canAct={canAct}
          bossPlayerId={boss.playerId}
          bossName={bossName}
          playerName={playerName}
          bossIsHit={bossIsHit}
          skills={availableSkills}
          teammates={teammates}
          onSkillUse={handleSkillUse}
          onSkipTurn={handleSkipTurn}
        />
      )}

      {/* Result overlay */}
      {phase === "RESULT" && battleResult && (
        <CoopBattleResult
          result={battleResult}
          expGained={expGained}
          essenceGained={essenceGained}
          levelsGained={levelsGained}
          bossName={bossName}
        />
      )}
    </div>
  );
}
