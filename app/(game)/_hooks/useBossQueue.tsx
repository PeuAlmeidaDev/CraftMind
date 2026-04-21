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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BossMatchData = {
  battleId: string;
  boss: { id: string; name: string; tier: number; category: string };
  teammates: { userId: string; characterId: string }[];
  acceptTimeoutMs: number;
};

type BossQueueState = {
  // Connection
  connected: boolean;

  // Queue
  inQueue: boolean;
  queueCategory: string | null;
  queuePosition: number;
  queueSize: number;
  queueTimeRemaining: number;

  // Match
  matchFound: boolean;
  matchData: BossMatchData | null;
  matchAcceptTimeRemaining: number;
  matchAccepted: boolean;

  // Battle redirect
  battleStarted: boolean;
  battleId: string | null;

  // Socket access (for boss-fight page to reuse the connection)
  getSocket: () => Socket | null;

  // Actions
  joinQueue: (category: string) => void;
  leaveQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const BossQueueContext = createContext<BossQueueState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SOCKET_URL =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : undefined) ?? "http://localhost:3001";

const QUEUE_TIMEOUT_SECONDS = 300; // 5 minutes

export function BossQueueProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const socketRef = useRef<Socket | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connection
  const [connected, setConnected] = useState(false);

  // Queue
  const [inQueue, setInQueue] = useState(false);
  const [queueCategory, setQueueCategory] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [queueTimeRemaining, setQueueTimeRemaining] = useState(0);

  // Match
  const [matchFound, setMatchFound] = useState(false);
  const [matchData, setMatchData] = useState<BossMatchData | null>(null);
  const [matchAcceptTimeRemaining, setMatchAcceptTimeRemaining] = useState(0);
  const [matchAccepted, setMatchAccepted] = useState(false);

  // Battle
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);

  // Refs to avoid stale closures in callbacks that read latest state
  const matchFoundRef = useRef(false);
  const battleStartedRef = useRef(false);

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
      setMatchAcceptTimeRemaining(seconds);

      matchTimerRef.current = setInterval(() => {
        setMatchAcceptTimeRemaining((prev) => {
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

  // -------------------------------------------------------------------------
  // Reset helpers
  // -------------------------------------------------------------------------

  const resetQueueState = useCallback(() => {
    setInQueue(false);
    setQueueCategory(null);
    setQueuePosition(0);
    setQueueSize(0);
    setQueueTimeRemaining(0);
    clearQueueTimer();
  }, [clearQueueTimer]);

  const resetMatchState = useCallback(() => {
    setMatchFound(false);
    matchFoundRef.current = false;
    setMatchData(null);
    setMatchAcceptTimeRemaining(0);
    setMatchAccepted(false);
    clearMatchTimer();
  }, [clearMatchTimer]);

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

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // --- Queue events ---

    socket.on(
      "boss:queue:status",
      (data: { position: number; size: number; category?: string }) => {
        setQueuePosition(data.position);
        setQueueSize(data.size);
      },
    );

    socket.on("boss:queue:timeout", (_data: { message: string }) => {
      resetQueueState();
    });

    socket.on("boss:queue:error", (data: { message: string }) => {
      console.error("[BossQueue] Error:", data.message);
    });

    socket.on("boss:queue:left", (_data: { message: string }) => {
      // Server confirmed we left the queue — state already reset by leaveQueue
    });

    // --- Match events ---

    socket.on("boss:match:found", (data: BossMatchData) => {
      resetQueueState();
      setMatchFound(true);
      matchFoundRef.current = true;
      setMatchData(data);
      setBattleId(data.battleId);
      startMatchTimer(data.acceptTimeoutMs);
    });

    socket.on("boss:match:cancelled", (_data: { reason?: string; message?: string }) => {
      resetMatchState();
      // Player may be re-queued server-side; listen for boss:queue:status to confirm
    });

    socket.on(
      "boss:match:accepted",
      (_data: { accepted: number; total: number }) => {
        // Optional: could surface accepted/total count to UI in the future
      },
    );

    socket.on("boss:match:timeout", (_data: { message: string }) => {
      resetMatchState();
    });

    // --- Battle events ---

    socket.on(
      "boss:battle:start",
      (data: { battleId: string; state: Record<string, unknown> }) => {
        clearMatchTimer();
        setMatchAcceptTimeRemaining(0);
        setMatchFound(false);
        matchFoundRef.current = false;
        setMatchData(null);
        setBattleStarted(true);
        battleStartedRef.current = true;
        setBattleId(data.battleId);
      },
    );

    socketRef.current = socket;
    socket.connect();

    return socket;
  }, [resetQueueState, resetMatchState, startMatchTimer, clearMatchTimer]);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const joinQueue = useCallback(
    (category: string) => {
      const socket = getSocket();
      socket.emit("boss:queue:join", { category });
      setInQueue(true);
      setQueueCategory(category);
      startQueueTimer();
    },
    [getSocket, startQueueTimer],
  );

  const leaveQueue = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("boss:queue:leave");
    }
    resetQueueState();

    // Disconnect if no active match/battle pending (use refs to avoid stale closure)
    if (!matchFoundRef.current && !battleStartedRef.current) {
      disconnectSocket();
    }
  }, [resetQueueState, disconnectSocket]);

  const acceptMatch = useCallback(() => {
    if (matchAccepted) return;
    const socket = socketRef.current;
    const currentBattleId = matchData?.battleId;
    if (socket && currentBattleId) {
      socket.emit("boss:match:accept", { battleId: currentBattleId });
      setMatchAccepted(true);
    }
  }, [matchData, matchAccepted]);

  const declineMatch = useCallback(() => {
    const socket = socketRef.current;
    const currentBattleId = matchData?.battleId;
    if (socket && currentBattleId) {
      socket.emit("boss:match:decline", { battleId: currentBattleId });
    }
    resetMatchState();
    setBattleId(null);

    // Disconnect since we declined
    disconnectSocket();
  }, [matchData, resetMatchState, disconnectSocket]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      clearQueueTimer();
      clearMatchTimer();
      disconnectSocket();
    };
  }, [clearQueueTimer, clearMatchTimer, disconnectSocket]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const getSocketRef = useCallback((): Socket | null => {
    return socketRef.current;
  }, []);

  const value: BossQueueState = {
    connected,
    inQueue,
    queueCategory,
    queuePosition,
    queueSize,
    queueTimeRemaining,
    matchFound,
    matchData,
    matchAcceptTimeRemaining,
    matchAccepted,
    battleStarted,
    battleId,
    getSocket: getSocketRef,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
  };

  return (
    <BossQueueContext.Provider value={value}>
      {children}
    </BossQueueContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBossQueue(): BossQueueState {
  const context = useContext(BossQueueContext);
  if (context === null) {
    throw new Error("useBossQueue must be used within a BossQueueProvider");
  }
  return context;
}
