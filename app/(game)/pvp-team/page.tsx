"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken, authFetchOptions, clearAuthAndRedirect } from "@/lib/client-auth";
import { usePvpTeamQueue } from "../_hooks/usePvpTeamQueue";
import PvpTeamBattleArena from "./_components/PvpTeamBattleArena";
import PvpTeamBattleResult from "./_components/PvpTeamBattleResult";
import PvpTeamLobby from "./_components/PvpTeamLobby";
import type { TurnLogEntry, PlayerState, BaseStats, ActiveStatusEffect } from "@/lib/battle/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BattlePhase = "LOADING" | "BATTLE" | "RESULT";

type SanitizedEnemyPlayer = {
  playerId: string;
  characterId: string;
  baseStats: BaseStats;
  currentHp: number;
  statusEffects: ActiveStatusEffect[];
};

type SanitizedPvpTeamState = {
  battleId: string;
  turnNumber: number;
  myTeam: PlayerState[];
  enemyTeam: SanitizedEnemyPlayer[];
  myTeamNumber: 1 | 2;
  mode: string;
  status: string;
  winnerTeam: 1 | 2 | null;
  turnLog: TurnLogEntry[];
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Page wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function PvpTeamPage() {
  return (
    <Suspense fallback={<PvpTeamLoading />}>
      <PvpTeamContent />
    </Suspense>
  );
}

function PvpTeamLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="mt-3 text-sm text-gray-400">Carregando...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function PvpTeamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleIdParam = searchParams.get("battleId");
  const { getSocket, reconnectSocket } = usePvpTeamQueue();

  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase
  const [phase, setPhase] = useState<BattlePhase>("LOADING");

  // Battle state
  const [myTeam, setMyTeam] = useState<PlayerState[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<SanitizedEnemyPlayer[]>([]);
  const [myTeamNumber, setMyTeamNumber] = useState<1 | 2>(1);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [turnNumber, setTurnNumber] = useState(1);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string | null>>({});
  const [playerHouses, setPlayerHouses] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<TurnLogEntry[]>([]);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(30);
  const [canAct, setCanAct] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [actionsReceived, setActionsReceived] = useState<{ count: number; total: number }>({
    count: 0,
    total: 0,
  });
  const [battleResult, setBattleResult] = useState<"VICTORY" | "DEFEAT" | "DRAW" | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
  const [autoSkipPlayers, setAutoSkipPlayers] = useState<Set<string>>(new Set());

  // Reconnection
  const [checkingActive, setCheckingActive] = useState(true);
  const [hasActiveBattle, setHasActiveBattle] = useState(false);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // -------------------------------------------------------------------------
  // Turn timer helpers
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
  // Check for active battle on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    // If we already have a battleId in params, skip active check
    if (battleIdParam) {
      setCheckingActive(false);
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

        if (json.data.hasBattle && json.data.battleType === "pvp-team") {
          setHasActiveBattle(true);
          setActiveBattleId(json.data.battleId);
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
  }, [router, battleIdParam]);

  // -------------------------------------------------------------------------
  // Fetch player profile
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
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => ac.abort();
  }, []);

  // -------------------------------------------------------------------------
  // Re-evaluate canAct
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentPlayerId || myTeam.length === 0 || phase !== "BATTLE") {
      setCanAct(false);
      return;
    }
    const me = myTeam.find((p) => p.playerId === currentPlayerId);
    setCanAct(!!me && me.currentHp > 0 && !actionSent);
  }, [myTeam, phase, currentPlayerId, actionSent]);

  // -------------------------------------------------------------------------
  // Process state update from server
  // -------------------------------------------------------------------------

  const processBattleState = useCallback(
    (data: { state: SanitizedPvpTeamState; events: TurnLogEntry[] }) => {
      const { state, events: turnEvents } = data;

      setMyTeam(state.myTeam);
      setEnemyTeam(state.enemyTeam);
      setMyTeamNumber(state.myTeamNumber);
      setTurnNumber(state.turnNumber);
      setPlayerNames(state.playerNames);
      setPlayerAvatars(state.playerAvatars);
      setPlayerHouses(state.playerHouses);

      if (turnEvents.length > 0) {
        setEvents((prev) => [...prev, ...turnEvents]);
      }

      // Reset action state for new turn
      setActionSent(false);
      setActionsReceived({ count: 0, total: 0 });

      if (state.status === "IN_PROGRESS") {
        startTurnTimer();
        setPhase((prev) => (prev === "LOADING" ? "BATTLE" : prev));
      }
    },
    [startTurnTimer],
  );

  // -------------------------------------------------------------------------
  // Reconnect handler
  // -------------------------------------------------------------------------

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      const socket = await reconnectSocket();

      socket.once(
        "pvp-team:battle:state",
        (data: { state: SanitizedPvpTeamState; events: TurnLogEntry[] }) => {
          processBattleState(data);
          setPhase("BATTLE");
          setHasActiveBattle(false);
          setReconnecting(false);
        },
      );

      socket.emit("pvp-team:battle:request-state");

      // Timeout: if no response in 5s
      setTimeout(() => {
        setReconnecting(false);
      }, 5000);
    } catch {
      setHasActiveBattle(false);
      setReconnecting(false);
    }
  }, [reconnectSocket, processBattleState]);

  // -------------------------------------------------------------------------
  // Socket connection & events
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!battleIdParam) return;

    const socket = getSocket();
    if (!socket || !socket.connected) return;

    // --- pvp-team:battle:state ---
    const handleBattleState = (data: {
      state: SanitizedPvpTeamState;
      events: TurnLogEntry[];
    }) => {
      processBattleState(data);
    };

    // --- pvp-team:action:received ---
    const handleActionReceived = (data: {
      playerId: string;
      total: number;
      expected: number;
    }) => {
      setActionsReceived({ count: data.total, total: data.expected });
    };

    // --- pvp-team:battle:end ---
    const handleBattleEnd = (data: { winnerTeam: 1 | 2 | null }) => {
      stopTurnTimer();
      setCanAct(false);

      if (data.winnerTeam === null) {
        setBattleResult("DRAW");
      } else if (data.winnerTeam === myTeamNumber) {
        setBattleResult("VICTORY");
      } else {
        setBattleResult("DEFEAT");
      }

      setPhase("RESULT");
    };

    // --- pvp-team:battle:player-disconnected ---
    const handlePlayerDisconnected = (data: { playerId: string }) => {
      setDisconnectedPlayers((prev) => {
        const next = new Set(prev);
        next.add(data.playerId);
        return next;
      });
    };

    // --- pvp-team:battle:player-reconnected ---
    const handlePlayerReconnected = (data: { playerId: string }) => {
      setDisconnectedPlayers((prev) => {
        const next = new Set(prev);
        next.delete(data.playerId);
        return next;
      });
    };

    // --- pvp-team:battle:player-auto-skip ---
    const handlePlayerAutoSkip = (data: { playerId: string }) => {
      setAutoSkipPlayers((prev) => {
        const next = new Set(prev);
        next.add(data.playerId);
        return next;
      });
    };

    // --- pvp-team:battle:error ---
    const handleError = (data: { message: string }) => {
      console.error("[PvpTeam] Error:", data.message);
    };

    socket.on("pvp-team:battle:state", handleBattleState);
    socket.on("pvp-team:action:received", handleActionReceived);
    socket.on("pvp-team:battle:end", handleBattleEnd);
    socket.on("pvp-team:battle:player-disconnected", handlePlayerDisconnected);
    socket.on("pvp-team:battle:player-reconnected", handlePlayerReconnected);
    socket.on("pvp-team:battle:player-auto-skip", handlePlayerAutoSkip);
    socket.on("pvp-team:battle:error", handleError);

    // Request current state
    socket.emit("pvp-team:battle:request-state");

    return () => {
      stopTurnTimer();
      socket.off("pvp-team:battle:state", handleBattleState);
      socket.off("pvp-team:action:received", handleActionReceived);
      socket.off("pvp-team:battle:end", handleBattleEnd);
      socket.off("pvp-team:battle:player-disconnected", handlePlayerDisconnected);
      socket.off("pvp-team:battle:player-reconnected", handlePlayerReconnected);
      socket.off("pvp-team:battle:player-auto-skip", handlePlayerAutoSkip);
      socket.off("pvp-team:battle:error", handleError);
    };
  }, [battleIdParam, getSocket, processBattleState, stopTurnTimer, myTeamNumber]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  const handleSkillUse = useCallback(
    (skillId: string, targetIndex?: number, targetId?: string) => {
      const socket = getSocket();
      if (!socket || !battleIdParam) return;

      socket.emit("pvp-team:battle:action", {
        battleId: battleIdParam,
        skillId,
        targetIndex,
        targetId,
      });

      setActionSent(true);
      setCanAct(false);
    },
    [battleIdParam, getSocket],
  );

  const handleSkipTurn = useCallback(() => {
    const socket = getSocket();
    if (!socket || !battleIdParam) return;

    socket.emit("pvp-team:battle:action", {
      battleId: battleIdParam,
      skillId: null,
    });

    setActionSent(true);
    setCanAct(false);
  }, [battleIdParam, getSocket]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Still checking for active battle
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

  // Active battle found but no battleId param — show reconnect banner
  if (hasActiveBattle && !battleIdParam) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="max-w-sm w-full rounded-xl border border-amber-500/30 p-8 text-center"
          style={{
            background:
              "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
          }}
        >
          <div className="text-5xl mb-4">&#9876;&#65039;</div>
          <h2 className="text-lg font-bold text-white mb-2">
            Batalha em andamento
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Voce tem uma batalha PvP Team ativa. Deseja reconectar?
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
          {activeBattleId && (
            <button
              type="button"
              onClick={() => router.push(`/pvp-team?battleId=${activeBattleId}`)}
              className="mt-3 w-full cursor-pointer rounded-lg py-3 text-sm text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
            >
              Reconectar via URL
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setHasActiveBattle(false);
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

  // No battleId and no active battle — show lobby
  if (!battleIdParam) {
    return <PvpTeamLobby />;
  }

  // Battle loading
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
      {phase === "BATTLE" && (
        <PvpTeamBattleArena
          myTeam={myTeam}
          enemyTeam={enemyTeam}
          myTeamNumber={myTeamNumber}
          currentPlayerId={currentPlayerId}
          turnNumber={turnNumber}
          events={events}
          turnTimeRemaining={turnTimeRemaining}
          canAct={canAct}
          actionSent={actionSent}
          actionsReceived={actionsReceived}
          playerNames={playerNames}
          playerAvatars={playerAvatars}
          playerHouses={playerHouses}
          disconnectedPlayers={disconnectedPlayers}
          autoSkipPlayers={autoSkipPlayers}
          onSkillUse={handleSkillUse}
          onSkipTurn={handleSkipTurn}
        />
      )}

      {/* Result overlay */}
      {phase === "RESULT" && battleResult && (
        <PvpTeamBattleResult result={battleResult} />
      )}
    </div>
  );
}
