"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Socket } from "socket.io-client";
import { getToken, authFetchOptions, clearAuthAndRedirect } from "@/lib/client-auth";
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
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
};

type BattlePhase = "LOADING" | "BATTLE" | "RESULT";

// ---------------------------------------------------------------------------
// Page wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function BossFightPage() {
  return (
    <Suspense fallback={<BossFightLoading />}>
      <BossFightContent />
    </Suspense>
  );
}

function BossFightLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="mt-3 text-sm text-gray-400">Carregando batalha...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function BossFightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleIdParam = searchParams.get("battleId");
  const { getSocket: getQueueSocket, reconnectSocket } = useBossQueue();
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
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string | null>>({});
  const [playerHouses, setPlayerHouses] = useState<Record<string, string>>({});
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [localHouseName, setLocalHouseName] = useState<string>("NOCTIS");

  // Reconnection
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeBattleType, setActiveBattleType] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Track previous events length for hit detection
  const prevEventsLengthRef = useRef(0);

  // -------------------------------------------------------------------------
  // Check for active battle on mount (reconnection)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();

    const checkActiveBattle = async () => {
      try {
        const res = await fetch("/api/battle/active", authFetchOptions(token, ac.signal));

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          setCheckingActive(false);
          return;
        }

        const json = (await res.json()) as {
          data:
            | { hasBattle: true; battleType: string; battleId: string }
            | { hasBattle: false };
        };

        if (json.data.hasBattle && json.data.battleType === "boss") {
          setActiveBattleType("boss");
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) {
          setCheckingActive(false);
        }
      }
    };

    checkActiveBattle();

    return () => ac.abort();
  }, [router]);

  // -------------------------------------------------------------------------
  // Reconnect handler
  // -------------------------------------------------------------------------

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      const socket = await reconnectSocket();
      socketRef.current = socket;

      // Register listeners before requesting state
      const onState = (data: { state: SanitizedCoopState; events: TurnLogEntry[] }) => {
        const { state, events: turnEvents } = data;
        setBoss(state.boss);
        setTeam(state.team);
        if (state.bossName) setBossName(state.bossName);
        if (state.playerNames) setPlayerNames(state.playerNames);
        if (state.playerAvatars) setPlayerAvatars(state.playerAvatars);
        if (state.playerHouses) setPlayerHouses(state.playerHouses);
        setTurnNumber(state.turnNumber);
        setEvents((prev) => [...prev, ...turnEvents]);
        setActedPlayers(new Set());
        setPhase("BATTLE");
        setActiveBattleType(null);
        setReconnecting(false);
      };

      socket.once("boss:battle:state", onState);
      socket.emit("boss:battle:request-state");

      // Timeout: if no response in 5s, give up
      await new Promise((resolve) => setTimeout(resolve, 5000));
      socket.off("boss:battle:state", onState);
      if (activeBattleType) setActiveBattleType(null);
    } catch {
      setActiveBattleType(null);
    } finally {
      setReconnecting(false);
    }
  }, [reconnectSocket, activeBattleType]);

  // -------------------------------------------------------------------------
  // Redirect if no battleId (only after checking for active battle)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (checkingActive) return;
    if (activeBattleType) return;
    if (!battleIdParam && phase === "LOADING") {
      router.push("/dashboard");
    }
  }, [battleIdParam, router, checkingActive, activeBattleType, phase]);

  // -------------------------------------------------------------------------
  // Fetch player profile for name
  // -------------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const ac = new AbortController();

    fetch("/api/user/profile", authFetchOptions(token, ac.signal))
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{
          data: { id: string; name: string; avatarUrl: string | null; house: { name: string } | null };
        }>;
      })
      .then((json) => {
        if (json) {
          setCurrentPlayerId(json.data.id);
          setPlayerName(json.data.name);
          setLocalAvatarUrl(json.data.avatarUrl);
          setLocalHouseName(json.data.house?.name ?? "NOCTIS");
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Network error — continue without profile
      });

    return () => ac.abort();
  }, []);

  // -------------------------------------------------------------------------
  // Re-evaluate canAct whenever relevant state changes
  // (profile loads after state, new turn arrives, acted set resets, etc.)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentPlayerId || team.length === 0 || phase !== "BATTLE") return;
    const me = team.find((p) => p.playerId === currentPlayerId);
    if (!me || me.currentHp <= 0) {
      setCanAct(false);
      return;
    }
    const alreadyActed = actedPlayers.has(currentPlayerId);
    setCanAct(!alreadyActed);
  }, [currentPlayerId, team, phase, actedPlayers]);

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
      // Socket may not be ready yet (reconnection in progress or page loaded without queue flow).
      // The checkActiveBattle useEffect handles reconnection and emits request-state directly.
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
      if (state.playerAvatars) setPlayerAvatars(state.playerAvatars);
      if (state.playerHouses) setPlayerHouses(state.playerHouses);
      setTurnNumber(state.turnNumber);
      setEvents((prev) => [...prev, ...turnEvents]);
      setActedPlayers(new Set());

      if (state.status === "IN_PROGRESS") {
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
    avatarUrl: p.playerId === currentPlayerId ? localAvatarUrl : (playerAvatars[p.playerId] ?? null),
    houseName: p.playerId === currentPlayerId ? localHouseName : (playerHouses[p.playerId] ?? undefined),
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

  if (checkingActive) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
          <p className="text-sm text-gray-400">Verificando batalha...</p>
        </div>
      </div>
    );
  }

  // Show reconnect banner if active battle detected but no battleIdParam
  if (activeBattleType && !battleIdParam) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="max-w-sm w-full rounded-xl border border-amber-500/30 p-8 text-center"
          style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}
        >
          <div className="text-5xl mb-4">&#9876;&#65039;</div>
          <h2 className="text-lg font-bold text-white mb-2">Batalha em andamento</h2>
          <p className="text-sm text-gray-400 mb-6">
            Voce tem uma batalha Boss Fight ativa. Deseja reconectar?
          </p>
          <button
            type="button"
            onClick={handleReconnect}
            disabled={reconnecting}
            className={`w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 transition ${
              reconnecting ? "opacity-60 cursor-not-allowed" : "hover:brightness-110"
            }`}
          >
            {reconnecting ? "Reconectando..." : "Reconectar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveBattleType(null);
              router.push("/dashboard");
            }}
            className="mt-3 w-full cursor-pointer rounded-lg py-3 text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

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
          playerNames={playerNames}
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
