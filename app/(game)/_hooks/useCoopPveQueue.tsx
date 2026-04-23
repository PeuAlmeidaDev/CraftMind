"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useLayoutSocket } from "./useLayoutSocket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoopPveMode = "2v3" | "2v5";

type MatchTeammate = { userId: string; name: string };
type MatchMob = { name: string; tier: number };

type SanitizedMobState = {
  playerId: string;
  baseStats: { physicalAtk: number; physicalDef: number; magicAtk: number; magicDef: number; hp: number; speed: number };
  currentHp: number;
  statusEffects: Array<{ status: string; remainingTurns: number }>;
  mobId: string;
  name: string;
  defeated: boolean;
  imageUrl: string | null;
};

type SanitizedCoopPveState = {
  battleId: string;
  turnNumber: number;
  team: Array<{
    playerId: string;
    baseStats: { physicalAtk: number; physicalDef: number; magicAtk: number; magicDef: number; hp: number; speed: number };
    currentHp: number;
    equippedSkills: Array<{
      skillId: string;
      slotIndex: number;
      skill: { name: string; description: string; basePower: number; damageType: string; target: string; cooldown: number; accuracy: number };
    }>;
    cooldowns: Record<string, number>;
    statusEffects: Array<{ status: string; remainingTurns: number }>;
    buffs: Array<{ stat: string; amount: number; remainingTurns: number }>;
    combo: number;
  }>;
  mobs: SanitizedMobState[];
  mode: CoopPveMode;
  status: "IN_PROGRESS" | "FINISHED";
  result: "PENDING" | "VICTORY" | "DEFEAT";
  turnLog: Array<Record<string, unknown>>;
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
  mobNames: Record<string, string>;
};

export type { SanitizedMobState, SanitizedCoopPveState };

type CoopPvePhase = "IDLE" | "QUEUE" | "MATCH" | "BATTLE" | "RESULT";

export type CoopPveInvitePhase = "IDLE" | "SENDING" | "WAITING" | "DECLINED" | "EXPIRED";

type CoopPveQueueState = {
  // Phase
  phase: CoopPvePhase;
  mode: CoopPveMode;

  // Queue
  queuePosition: number;
  queueSize: number;
  queueTimeRemaining: number;

  // Match
  matchBattleId: string | null;
  matchTeammate: MatchTeammate | null;
  matchMobs: MatchMob[];
  matchAcceptTimeout: number;
  matchAcceptedCount: number;
  matchExpectedCount: number;

  // Battle
  battleId: string | null;
  battleState: SanitizedCoopPveState | null;
  turnTimeRemaining: number;
  actedPlayers: Set<string>;
  turnEvents: Array<Record<string, unknown>>;

  // Disconnection
  disconnectedPlayer: string | null;
  gracePeriodMs: number;

  // Result
  result: "VICTORY" | "DEFEAT" | null;
  expGained: number;
  levelsGained: number;
  newLevel: number;

  // Invite (sender side)
  invitePhase: CoopPveInvitePhase;
  inviteTargetName: string | null;

  // Actions
  setMode: (mode: CoopPveMode) => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
  sendAction: (skillId: string, targetIndex?: number, targetId?: string) => void;
  requestState: () => void;
  playAgain: () => void;
  getSocket: () => Socket | null;
  reconnectSocket: () => Promise<Socket>;
  sendInvite: (targetUserId: string, targetName: string) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CoopPveQueueContext = createContext<CoopPveQueueState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

const QUEUE_TIMEOUT_SECONDS = 300; // 5 minutes
const TURN_TIMEOUT_SECONDS = 30;

export function CoopPveProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const layoutSocket = useLayoutSocket();
  const socketRef = useRef<Socket | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase
  const [phase, setPhase] = useState<CoopPvePhase>("IDLE");
  const [mode, setMode] = useState<CoopPveMode>("2v3");

  // Queue
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [queueTimeRemaining, setQueueTimeRemaining] = useState(0);

  // Match
  const [matchBattleId, setMatchBattleId] = useState<string | null>(null);
  const [matchTeammate, setMatchTeammate] = useState<MatchTeammate | null>(null);
  const [matchMobs, setMatchMobs] = useState<MatchMob[]>([]);
  const [matchAcceptTimeout, setMatchAcceptTimeout] = useState(0);
  const [matchAcceptedCount, setMatchAcceptedCount] = useState(0);
  const [matchExpectedCount, setMatchExpectedCount] = useState(2);

  // Battle
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<SanitizedCoopPveState | null>(null);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_TIMEOUT_SECONDS);
  const [actedPlayers, setActedPlayers] = useState<Set<string>>(new Set());
  const [turnEvents, setTurnEvents] = useState<Array<Record<string, unknown>>>([]);

  // Disconnection
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<string | null>(null);
  const [gracePeriodMs, setGracePeriodMs] = useState(0);

  // Result
  const [result, setResult] = useState<"VICTORY" | "DEFEAT" | null>(null);
  const [expGained, setExpGained] = useState(0);
  const [levelsGained, setLevelsGained] = useState(0);
  const [newLevel, setNewLevel] = useState(0);

  // Invite (sender side)
  const [invitePhase, setInvitePhase] = useState<CoopPveInvitePhase>("IDLE");
  const [inviteTargetName, setInviteTargetName] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Timer helpers
  // -------------------------------------------------------------------------

  const clearQueueTimer = useCallback(() => {
    if (queueTimerRef.current !== null) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }
  }, []);

  const clearMatchTimer = useCallback(() => {
    if (matchTimerRef.current !== null) {
      clearInterval(matchTimerRef.current);
      matchTimerRef.current = null;
    }
  }, []);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current !== null) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const startQueueTimer = useCallback(() => {
    clearQueueTimer();
    setQueueTimeRemaining(QUEUE_TIMEOUT_SECONDS);

    queueTimerRef.current = setInterval(() => {
      setQueueTimeRemaining((prev) => {
        if (prev <= 1) {
          clearQueueTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearQueueTimer]);

  const startMatchTimer = useCallback(
    (timeoutMs: number) => {
      clearMatchTimer();
      const seconds = Math.ceil(timeoutMs / 1000);
      setMatchAcceptTimeout(seconds);

      matchTimerRef.current = setInterval(() => {
        setMatchAcceptTimeout((prev) => {
          if (prev <= 1) {
            clearMatchTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearMatchTimer],
  );

  const startTurnTimer = useCallback(() => {
    clearTurnTimer();
    setTurnTimeRemaining(TURN_TIMEOUT_SECONDS);

    turnTimerRef.current = setInterval(() => {
      setTurnTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTurnTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTurnTimer]);

  // -------------------------------------------------------------------------
  // Socket connection (lazy)
  // -------------------------------------------------------------------------

  const getSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current;

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    const socket = io(SOCKET_URL, {
      auth: { token: token ?? "" },
      autoConnect: false,
      forceNew: true,
    });

    socket.on("connect", () => {
      // connected
    });

    socket.on("disconnect", () => {
      // disconnected
    });

    // --- Queue events ---

    socket.on(
      "coop-pve:queue:status",
      (data: { position: number; size: number; mode: CoopPveMode }) => {
        setQueuePosition(data.position);
        setQueueSize(data.size);
      },
    );

    socket.on("coop-pve:queue:timeout", (_data: { message: string }) => {
      clearQueueTimer();
      setPhase("IDLE");
    });

    socket.on("coop-pve:queue:left", (_data: { message: string }) => {
      // Server confirmed we left — state already reset by leaveQueue
    });

    // --- Match events ---

    socket.on(
      "coop-pve:match:found",
      (data: {
        battleId: string;
        teammate: MatchTeammate;
        mobs: MatchMob[];
        mode: CoopPveMode;
        acceptTimeoutMs: number;
      }) => {
        clearQueueTimer();
        setPhase("MATCH");
        setMatchBattleId(data.battleId);
        setBattleId(data.battleId);
        setMatchTeammate(data.teammate);
        setMatchMobs(data.mobs);
        setMatchAcceptedCount(0);
        setMatchExpectedCount(2);
        startMatchTimer(data.acceptTimeoutMs);
      },
    );

    socket.on(
      "coop-pve:match:accepted",
      (data: { accepted: number; total: number }) => {
        setMatchAcceptedCount(data.accepted);
        setMatchExpectedCount(data.total);
      },
    );

    socket.on("coop-pve:match:cancelled", (_data: { message: string }) => {
      clearMatchTimer();
      setMatchBattleId(null);
      setMatchTeammate(null);
      setMatchMobs([]);
      setMatchAcceptTimeout(0);
      setPhase("IDLE");
    });

    // --- Battle events ---

    socket.on(
      "coop-pve:battle:start",
      (data: { battleId: string; state: SanitizedCoopPveState }) => {
        clearMatchTimer();
        setPhase("BATTLE");
        setBattleId(data.battleId);
        setBattleState(data.state);
        setActedPlayers(new Set());
        setInvitePhase("IDLE");
        setInviteTargetName(null);
        startTurnTimer();
      },
    );

    socket.on(
      "coop-pve:battle:state",
      (data: { state: SanitizedCoopPveState; events: Array<Record<string, unknown>> }) => {
        setBattleState(data.state);
        setBattleId(data.state.battleId);
        setTurnEvents(data.events);
        setActedPlayers(new Set());
        startTurnTimer();
        // Reconexão: se o phase não é BATTLE, transicionar
        setPhase((prev) => (prev !== "BATTLE" && prev !== "RESULT" ? "BATTLE" : prev));
      },
    );

    socket.on(
      "coop-pve:battle:end",
      (data: {
        result: "VICTORY" | "DEFEAT";
        expGained: number;
        levelsGained?: number;
        newLevel?: number;
      }) => {
        clearTurnTimer();
        setPhase("RESULT");
        setResult(data.result);
        setExpGained(data.expGained);
        setLevelsGained(data.levelsGained ?? 0);
        setNewLevel(data.newLevel ?? 0);
      },
    );

    socket.on(
      "coop-pve:action:received",
      (data: { playerId: string; total: number; expected: number }) => {
        setActedPlayers((prev) => {
          const next = new Set(prev);
          next.add(data.playerId);
          return next;
        });
      },
    );

    socket.on(
      "coop-pve:battle:player-disconnected",
      (data: { playerId: string; gracePeriodMs: number }) => {
        setDisconnectedPlayer(data.playerId);
        setGracePeriodMs(data.gracePeriodMs);
      },
    );

    socket.on(
      "coop-pve:battle:player-reconnected",
      (_data: { playerId: string }) => {
        setDisconnectedPlayer(null);
        setGracePeriodMs(0);
      },
    );

    // --- Invite events (sender side) ---

    socket.on("coop-pve:invite:sent", (_data: { inviteId: string; targetUserId: string; mode: string }) => {
      setInvitePhase("WAITING");
    });

    socket.on("coop-pve:invite:declined", (_data: { inviteId: string }) => {
      setInvitePhase("DECLINED");
      setTimeout(() => {
        setInvitePhase("IDLE");
        setInviteTargetName(null);
      }, 2000);
    });

    socket.on("coop-pve:invite:expired", (_data: { inviteId: string }) => {
      setInvitePhase("EXPIRED");
      setTimeout(() => {
        setInvitePhase("IDLE");
        setInviteTargetName(null);
      }, 2000);
    });

    socket.on("coop-pve:invite:error", (_data: { message: string }) => {
      setInvitePhase("IDLE");
      setInviteTargetName(null);
    });

    socketRef.current = socket;
    socket.connect();

    return socket;
  }, [clearQueueTimer, clearMatchTimer, startMatchTimer, startTurnTimer, clearTurnTimer]);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const joinQueue = useCallback(() => {
    const socket = getSocket();
    socket.emit("coop-pve:queue:join", { mode });
    setPhase("QUEUE");
    startQueueTimer();
  }, [getSocket, mode, startQueueTimer]);

  const leaveQueue = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("coop-pve:queue:leave");
    }
    clearQueueTimer();
    setPhase("IDLE");
    setQueuePosition(0);
    setQueueSize(0);
    setQueueTimeRemaining(0);
    disconnectSocket();
  }, [clearQueueTimer, disconnectSocket]);

  const acceptMatch = useCallback(() => {
    const socket = socketRef.current;
    if (socket && matchBattleId) {
      socket.emit("coop-pve:match:accept", { battleId: matchBattleId });
    }
  }, [matchBattleId]);

  const declineMatch = useCallback(() => {
    const socket = socketRef.current;
    if (socket && matchBattleId) {
      socket.emit("coop-pve:match:decline", { battleId: matchBattleId });
    }
    clearMatchTimer();
    setMatchBattleId(null);
    setMatchTeammate(null);
    setMatchMobs([]);
    setMatchAcceptTimeout(0);
    setBattleId(null);
    setPhase("IDLE");
    disconnectSocket();
  }, [matchBattleId, clearMatchTimer, disconnectSocket]);

  const sendAction = useCallback(
    (skillId: string, targetIndex?: number, targetId?: string) => {
      const socket = socketRef.current;
      if (socket && battleId) {
        socket.emit("coop-pve:action", {
          battleId,
          skillId,
          targetIndex: targetIndex ?? undefined,
          targetId: targetId ?? undefined,
        });
      }
    },
    [battleId],
  );

  const requestState = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      socket.emit("coop-pve:battle:request-state");
    } else {
      socket.once("connect", () => {
        socket.emit("coop-pve:battle:request-state");
      });
    }
  }, []);

  const sendInvite = useCallback((targetUserId: string, targetName: string) => {
    const socket = getSocket();
    socket.emit("coop-pve:invite:send", { targetUserId, mode });
    setInvitePhase("SENDING");
    setInviteTargetName(targetName);
  }, [getSocket, mode]);

  const playAgain = useCallback(() => {
    clearTurnTimer();
    setPhase("IDLE");
    setBattleId(null);
    setBattleState(null);
    setResult(null);
    setExpGained(0);
    setLevelsGained(0);
    setNewLevel(0);
    setActedPlayers(new Set());
    setTurnEvents([]);
    setDisconnectedPlayer(null);
    setGracePeriodMs(0);
    setMatchBattleId(null);
    setMatchTeammate(null);
    setMatchMobs([]);
    disconnectSocket();
  }, [clearTurnTimer, disconnectSocket]);

  const getSocketRef = useCallback((): Socket | null => {
    return socketRef.current;
  }, []);

  const reconnectSocket = useCallback((): Promise<Socket> => {
    const existing = socketRef.current;

    // Already connected — resolve immediately
    if (existing && existing.connected) {
      return Promise.resolve(existing);
    }

    // Exists but disconnected — reconnect
    if (existing) {
      return new Promise<Socket>((resolve) => {
        existing.once("connect", () => resolve(existing));
        existing.connect();
      });
    }

    // Does not exist — create a new socket (same logic as getSocket)
    return new Promise<Socket>((resolve) => {
      const socket = getSocket(); // creates + connects
      if (socket.connected) {
        resolve(socket);
      } else {
        socket.once("connect", () => resolve(socket));
      }
    });
  }, [getSocket]);

  // -------------------------------------------------------------------------
  // Auto-connect when redirected from invite accept (?invited=true)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("invited") !== "true") return;

    // Wait for layout socket to be available before proceeding
    if (!layoutSocket) {
      // Don't remove the param yet — wait for next run when layoutSocket is ready
      return;
    }

    // Remove query param from URL without reload (only after socket is ready)
    const url = new URL(window.location.href);
    url.searchParams.delete("invited");
    window.history.replaceState({}, "", url.pathname);

    // Use the LAYOUT socket to request battle state
    // Socket.io buffers emits until connected, so no need to check .connected
    const socketToUse = layoutSocket;

    if (!socketToUse) {
      // Fallback: try creating own socket (should not reach here)
      const socket = getSocket();
      setPhase("BATTLE");

      let retryCount = 0;
      const maxRetries = 8;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;

      const emitRequestState = () => {
        socket.emit("coop-pve:battle:request-state");
        retryCount++;
        if (retryCount < maxRetries) {
          retryTimer = setTimeout(emitRequestState, 1000);
        }
      };

      const startRequesting = () => {
        retryTimer = setTimeout(emitRequestState, 500);
      };

      if (socket.connected) {
        startRequesting();
      } else {
        socket.once("connect", startRequesting);
      }

      return () => {
        if (retryTimer) clearTimeout(retryTimer);
        socket.off("connect", startRequesting);
      };
    }

    // Use layout socket: register battle listeners and request state
    setPhase("BATTLE");

    const handleBattleState = (data: { state: SanitizedCoopPveState; events: Array<Record<string, unknown>> }) => {
      setBattleState(data.state);
      setBattleId(data.state.battleId);
      setTurnEvents(data.events);
      setActedPlayers(new Set());
      startTurnTimer();
    };

    const handleBattleEnd = (data: { result: "VICTORY" | "DEFEAT"; expGained: number; levelsGained?: number; newLevel?: number }) => {
      clearTurnTimer();
      setPhase("RESULT");
      setResult(data.result);
      setExpGained(data.expGained);
      setLevelsGained(data.levelsGained ?? 0);
      setNewLevel(data.newLevel ?? 0);
    };

    const handleActionReceived = (data: { playerId: string }) => {
      setActedPlayers((prev) => {
        const next = new Set(prev);
        next.add(data.playerId);
        return next;
      });
    };

    socketToUse.on("coop-pve:battle:state", handleBattleState);
    socketToUse.on("coop-pve:battle:end", handleBattleEnd);
    socketToUse.on("coop-pve:action:received", handleActionReceived);

    // Store reference so sendAction can use it
    socketRef.current = socketToUse;

    // Request state
    socketToUse.emit("coop-pve:battle:request-state");

    // Retry if no response
    let retryCount = 0;
    const retryTimer = setInterval(() => {
      retryCount++;
      if (retryCount >= 5) {
        clearInterval(retryTimer);
        return;
      }
      if (!battleState) {
        socketToUse.emit("coop-pve:battle:request-state");
      }
    }, 1500);

    return () => {
      clearInterval(retryTimer);
      socketToUse.off("coop-pve:battle:state", handleBattleState);
      socketToUse.off("coop-pve:battle:end", handleBattleEnd);
      socketToUse.off("coop-pve:action:received", handleActionReceived);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSocket]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      clearQueueTimer();
      clearMatchTimer();
      clearTurnTimer();
      disconnectSocket();
    };
  }, [clearQueueTimer, clearMatchTimer, clearTurnTimer, disconnectSocket]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value: CoopPveQueueState = {
    phase,
    mode,
    queuePosition,
    queueSize,
    queueTimeRemaining,
    matchBattleId,
    matchTeammate,
    matchMobs,
    matchAcceptTimeout,
    matchAcceptedCount,
    matchExpectedCount,
    battleId,
    battleState,
    turnTimeRemaining,
    actedPlayers,
    turnEvents,
    disconnectedPlayer,
    gracePeriodMs,
    result,
    expGained,
    levelsGained,
    newLevel,
    invitePhase,
    inviteTargetName,
    setMode,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    sendAction,
    requestState,
    playAgain,
    getSocket: getSocketRef,
    reconnectSocket,
    sendInvite,
  };

  return (
    <CoopPveQueueContext.Provider value={value}>
      {children}
    </CoopPveQueueContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCoopPveQueue(): CoopPveQueueState {
  const context = useContext(CoopPveQueueContext);
  if (context === null) {
    throw new Error("useCoopPveQueue must be used within a CoopPveProvider");
  }
  return context;
}
