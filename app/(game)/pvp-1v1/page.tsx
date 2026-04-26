"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken, authFetchOptions, clearAuthAndRedirect } from "@/lib/client-auth";
import { usePvp1v1Queue } from "../_hooks/usePvp1v1Queue";
import Pvp1v1BattleArena from "./_components/Pvp1v1BattleArena";
import Pvp1v1BattleResult from "./_components/Pvp1v1BattleResult";
import Pvp1v1Lobby from "./_components/Pvp1v1Lobby";
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

type SanitizedBattleState = {
  battleId: string;
  turnNumber: number;
  players: [PlayerState | SanitizedEnemyPlayer, PlayerState | SanitizedEnemyPlayer];
  turnLog: TurnLogEntry[];
  status: string;
  winnerId: string | null;
};

// ---------------------------------------------------------------------------
// Page wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function Pvp1v1Page() {
  return (
    <Suspense fallback={<Pvp1v1Loading />}>
      <Pvp1v1Content />
    </Suspense>
  );
}

function Pvp1v1Loading() {
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

function Pvp1v1Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleIdParam = searchParams.get("battleId");
  const { getSocket, reconnectSocket } = usePvp1v1Queue();

  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase
  const [phase, setPhase] = useState<BattlePhase>("LOADING");

  // Battle state
  const [myPlayer, setMyPlayer] = useState<PlayerState | null>(null);
  const [enemyPlayer, setEnemyPlayer] = useState<SanitizedEnemyPlayer | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [turnNumber, setTurnNumber] = useState(1);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string | null>>({});
  const [playerHouses, setPlayerHouses] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<TurnLogEntry[]>([]);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(30);
  const [canAct, setCanAct] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [battleResult, setBattleResult] = useState<"VICTORY" | "DEFEAT" | "DRAW" | null>(null);
  const [isEnemyDisconnected, setIsEnemyDisconnected] = useState(false);

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

        if (json.data.hasBattle && json.data.battleType === "pvp") {
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
          data: {
            id: string;
            name: string;
            avatarUrl: string | null;
            house: { name: string } | null;
          };
        }>;
      })
      .then((json) => {
        if (json) {
          setCurrentPlayerId(json.data.id);
          setPlayerNames((prev) => ({ ...prev, [json.data.id]: json.data.name }));
          setPlayerAvatars((prev) => ({ ...prev, [json.data.id]: json.data.avatarUrl }));
          if (json.data.house) {
            setPlayerHouses((prev) => ({ ...prev, [json.data.id]: json.data.house!.name }));
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => ac.abort();
  }, []);

  // -------------------------------------------------------------------------
  // Fetch opponent profile when enemy is identified
  // -------------------------------------------------------------------------

  const fetchedOpponentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enemyPlayer || !currentPlayerId) return;
    if (fetchedOpponentRef.current === enemyPlayer.playerId) return;

    const token = getToken();
    if (!token) return;

    const opponentId = enemyPlayer.playerId;
    fetchedOpponentRef.current = opponentId;

    const ac = new AbortController();

    fetch(`/api/user/${opponentId}/profile`, authFetchOptions(token, ac.signal))
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{
          data: {
            id: string;
            name: string;
            avatarUrl: string | null;
            house: { name: string } | null;
          };
        }>;
      })
      .then((json) => {
        if (json) {
          setPlayerNames((prev) => ({ ...prev, [opponentId]: json.data.name }));
          setPlayerAvatars((prev) => ({ ...prev, [opponentId]: json.data.avatarUrl }));
          if (json.data.house) {
            setPlayerHouses((prev) => ({ ...prev, [opponentId]: json.data.house!.name }));
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => ac.abort();
  }, [enemyPlayer, currentPlayerId]);

  // -------------------------------------------------------------------------
  // Re-evaluate canAct
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentPlayerId || !myPlayer || phase !== "BATTLE") {
      setCanAct(false);
      return;
    }
    setCanAct(myPlayer.currentHp > 0 && !actionSent);
  }, [myPlayer, phase, currentPlayerId, actionSent]);

  // -------------------------------------------------------------------------
  // Process state update from server
  // -------------------------------------------------------------------------

  const processBattleState = useCallback(
    (data: { state: SanitizedBattleState; events: TurnLogEntry[] }) => {
      const { state, events: turnEvents } = data;

      // Identify local player vs opponent in the players array
      const p0 = state.players[0];
      const p1 = state.players[1];

      // The local player has equippedSkills (full PlayerState)
      // The opponent is sanitized (no equippedSkills)
      let local: PlayerState | null = null;
      let opponent: SanitizedEnemyPlayer | null = null;

      if ("equippedSkills" in p0 && p0.playerId === currentPlayerId) {
        local = p0 as PlayerState;
        opponent = p1 as SanitizedEnemyPlayer;
      } else if ("equippedSkills" in p1 && p1.playerId === currentPlayerId) {
        local = p1 as PlayerState;
        opponent = p0 as SanitizedEnemyPlayer;
      } else if ("equippedSkills" in p0) {
        // currentPlayerId may not be set yet — the one with equippedSkills is us
        local = p0 as PlayerState;
        opponent = p1 as SanitizedEnemyPlayer;
        if (!currentPlayerId) {
          setCurrentPlayerId(p0.playerId);
        }
      } else if ("equippedSkills" in p1) {
        local = p1 as PlayerState;
        opponent = p0 as SanitizedEnemyPlayer;
        if (!currentPlayerId) {
          setCurrentPlayerId(p1.playerId);
        }
      }

      if (local) setMyPlayer(local);
      if (opponent) setEnemyPlayer(opponent);
      setTurnNumber(state.turnNumber);

      if (turnEvents.length > 0) {
        setEvents((prev) => [...prev, ...turnEvents]);
      }

      // Reset action state for new turn
      setActionSent(false);

      if (state.status === "IN_PROGRESS") {
        startTurnTimer();
        setPhase((prev) => (prev === "LOADING" ? "BATTLE" : prev));
      }
    },
    [startTurnTimer, currentPlayerId],
  );

  // -------------------------------------------------------------------------
  // Reconnect handler
  // -------------------------------------------------------------------------

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      const socket = await reconnectSocket();

      socket.once(
        "battle:state",
        (data: { state: SanitizedBattleState; events: TurnLogEntry[] }) => {
          processBattleState(data);
          setPhase("BATTLE");
          setHasActiveBattle(false);
          setReconnecting(false);
        },
      );

      // Server sends battle:state automatically on reconnection
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

    // --- battle:state ---
    const handleBattleState = (data: {
      state: SanitizedBattleState;
      events: TurnLogEntry[];
    }) => {
      processBattleState(data);
    };

    // --- battle:end ---
    const handleBattleEnd = (data: { winnerId: string | null }) => {
      stopTurnTimer();
      setCanAct(false);

      if (data.winnerId === null) {
        setBattleResult("DRAW");
      } else if (data.winnerId === currentPlayerId) {
        setBattleResult("VICTORY");
      } else {
        setBattleResult("DEFEAT");
      }

      setPhase("RESULT");
    };

    // --- battle:player-disconnected ---
    const handlePlayerDisconnected = (data: { playerId: string }) => {
      if (data.playerId !== currentPlayerId) {
        setIsEnemyDisconnected(true);
      }
    };

    // --- battle:player-reconnected ---
    const handlePlayerReconnected = (data: { playerId: string }) => {
      if (data.playerId !== currentPlayerId) {
        setIsEnemyDisconnected(false);
      }
    };

    // --- battle:error ---
    const handleError = (data: { message: string }) => {
      console.error("[Pvp1v1] Error:", data.message);
    };

    socket.on("battle:state", handleBattleState);
    socket.on("battle:end", handleBattleEnd);
    socket.on("battle:player-disconnected", handlePlayerDisconnected);
    socket.on("battle:player-reconnected", handlePlayerReconnected);
    socket.on("battle:error", handleError);

    return () => {
      stopTurnTimer();
      socket.off("battle:state", handleBattleState);
      socket.off("battle:end", handleBattleEnd);
      socket.off("battle:player-disconnected", handlePlayerDisconnected);
      socket.off("battle:player-reconnected", handlePlayerReconnected);
      socket.off("battle:error", handleError);
    };
  }, [battleIdParam, getSocket, processBattleState, stopTurnTimer, currentPlayerId]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  const handleSkillUse = useCallback(
    (skillId: string) => {
      const socket = getSocket();
      if (!socket || !battleIdParam) return;

      socket.emit("battle:action", {
        battleId: battleIdParam,
        skillId,
      });

      setActionSent(true);
      setCanAct(false);
    },
    [battleIdParam, getSocket],
  );

  const handleSkipTurn = useCallback(() => {
    const socket = getSocket();
    if (!socket || !battleIdParam) return;

    socket.emit("battle:action", {
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
            Voce tem uma batalha PvP 1v1 ativa. Deseja reconectar?
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
              onClick={() => router.push(`/pvp-1v1?battleId=${activeBattleId}`)}
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
    return <Pvp1v1Lobby />;
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
      {phase === "BATTLE" && myPlayer && enemyPlayer && (
        <Pvp1v1BattleArena
          myPlayer={myPlayer}
          enemyPlayer={enemyPlayer}
          currentPlayerId={currentPlayerId}
          turnNumber={turnNumber}
          events={events}
          turnTimeRemaining={turnTimeRemaining}
          canAct={canAct}
          actionSent={actionSent}
          playerNames={playerNames}
          playerAvatars={playerAvatars}
          playerHouses={playerHouses}
          isEnemyDisconnected={isEnemyDisconnected}
          onSkillUse={handleSkillUse}
          onSkipTurn={handleSkipTurn}
        />
      )}

      {/* Result overlay */}
      {phase === "RESULT" && battleResult && (
        <Pvp1v1BattleResult result={battleResult} />
      )}
    </div>
  );
}
