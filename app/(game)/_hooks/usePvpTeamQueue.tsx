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

type PvpTeamMatchPlayer = {
  userId: string;
  name: string;
};

type PvpTeamMatchData = {
  battleId: string;
  myTeam: 1 | 2;
  teammates: PvpTeamMatchPlayer[];
  opponents: PvpTeamMatchPlayer[];
};

type PvpTeamQueueContextValue = {
  // Connection
  connected: boolean;

  // Queue
  inQueue: boolean;
  isDuoQueue: boolean;
  queuePosition: number;
  queueSize: number;
  queueTimeRemaining: number;

  // Match
  matchFound: boolean;
  matchData: PvpTeamMatchData | null;
  matchAcceptTimeRemaining: number;
  matchAccepted: boolean;
  matchAcceptedCount: number;

  // Battle redirect
  battleStarted: boolean;
  battleId: string | null;

  // Invite
  pendingInvite: {
    inviteId: string;
    senderId: string;
    senderName: string;
  } | null;
  inviteSent: boolean;
  inviteError: string | null;

  // Socket access
  getSocket: () => Socket | null;
  reconnectSocket: () => Promise<Socket>;

  // Actions
  joinQueue: () => void;
  leaveQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
  sendInvite: (targetUserId: string) => void;
  acceptInvite: (inviteId: string) => void;
  declineInvite: (inviteId: string) => void;
  clearInviteError: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const PvpTeamQueueContext =
  createContext<PvpTeamQueueContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

const QUEUE_TIMEOUT_SECONDS = 300; // 5 minutes

export function PvpTeamQueueProvider({
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
  const [isDuoQueue, setIsDuoQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [queueTimeRemaining, setQueueTimeRemaining] = useState(0);

  // Match
  const [matchFound, setMatchFound] = useState(false);
  const [matchData, setMatchData] = useState<PvpTeamMatchData | null>(null);
  const [matchAcceptTimeRemaining, setMatchAcceptTimeRemaining] = useState(0);
  const [matchAccepted, setMatchAccepted] = useState(false);
  const [matchAcceptedCount, setMatchAcceptedCount] = useState(0);

  // Battle
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);

  // Invite
  const [pendingInvite, setPendingInvite] = useState<{
    inviteId: string;
    senderId: string;
    senderName: string;
  } | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Refs to avoid stale closures
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
    setIsDuoQueue(false);
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
    setMatchAcceptedCount(0);
    clearMatchTimer();
  }, [clearMatchTimer]);

  const resetInviteState = useCallback(() => {
    setPendingInvite(null);
    setInviteSent(false);
    setInviteError(null);
  }, []);

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
      "pvp-team:queue:status",
      (data: { position?: number; size?: number; message?: string; isDuo?: boolean }) => {
        if (typeof data.position === "number") setQueuePosition(data.position);
        if (typeof data.size === "number") setQueueSize(data.size);
        if (data.isDuo) {
          setIsDuoQueue(true);
          setInQueue(true);
          startQueueTimer();
        }
      },
    );

    socket.on("pvp-team:queue:timeout", () => {
      resetQueueState();
    });

    socket.on("pvp-team:queue:error", (data: { message: string }) => {
      console.error("[PvpTeamQueue] Error:", data.message);
    });

    socket.on("pvp-team:queue:left", () => {
      // Server confirmed we left — state already reset by leaveQueue
    });

    // --- Match events ---

    socket.on(
      "pvp-team:match:found",
      (data: {
        battleId: string;
        myTeam: 1 | 2;
        teammates: PvpTeamMatchPlayer[];
        opponents: PvpTeamMatchPlayer[];
        acceptTimeoutMs: number;
      }) => {
        resetQueueState();
        setMatchFound(true);
        matchFoundRef.current = true;
        setMatchData({
          battleId: data.battleId,
          myTeam: data.myTeam,
          teammates: data.teammates,
          opponents: data.opponents,
        });
        setBattleId(data.battleId);
        setMatchAcceptedCount(0);
        startMatchTimer(data.acceptTimeoutMs);
      },
    );

    socket.on(
      "pvp-team:match:accepted",
      (data: { accepted: number; total: number }) => {
        setMatchAcceptedCount(data.accepted);
      },
    );

    socket.on("pvp-team:match:cancelled", () => {
      resetMatchState();
    });

    socket.on("pvp-team:match:timeout", () => {
      resetMatchState();
    });

    // --- Battle events ---

    socket.on("pvp-team:battle:start", (data: { battleId: string }) => {
      clearMatchTimer();
      setMatchAcceptTimeRemaining(0);
      setMatchFound(false);
      matchFoundRef.current = false;
      // Keep matchData around so the modal redirect can use it
      setBattleStarted(true);
      battleStartedRef.current = true;
      setBattleId(data.battleId);
    });

    // --- Invite events ---

    socket.on(
      "pvp-team:invite:received",
      (data: { inviteId: string; from: { userId: string; name: string } }) => {
        setPendingInvite({
          inviteId: data.inviteId,
          senderId: data.from.userId,
          senderName: data.from.name,
        });
      },
    );

    socket.on("pvp-team:invite:sent", () => {
      setInviteSent(true);
    });

    socket.on("pvp-team:invite:declined", () => {
      resetInviteState();
    });

    socket.on("pvp-team:invite:expired", () => {
      resetInviteState();
      setPendingInvite(null);
    });

    socket.on("pvp-team:invite:error", (data: { message: string }) => {
      setInviteError(data.message);
      console.error("[PvpTeamInvite] Error:", data.message);
    });

    socketRef.current = socket;
    socket.connect();

    return socket;
  }, [
    resetQueueState,
    resetMatchState,
    resetInviteState,
    startMatchTimer,
    startQueueTimer,
    clearMatchTimer,
  ]);

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

  const joinQueue = useCallback(() => {
    const socket = getSocket();
    socket.emit("pvp-team:queue:join");
    setInQueue(true);
    setIsDuoQueue(false);
    startQueueTimer();
  }, [getSocket, startQueueTimer]);

  const leaveQueue = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("pvp-team:queue:leave");
    }
    resetQueueState();

    if (!matchFoundRef.current && !battleStartedRef.current) {
      disconnectSocket();
    }
  }, [resetQueueState, disconnectSocket]);

  const acceptMatch = useCallback(() => {
    if (matchAccepted) return;
    const socket = socketRef.current;
    const currentBattleId = matchData?.battleId;
    if (socket && currentBattleId) {
      socket.emit("pvp-team:match:accept", { battleId: currentBattleId });
      setMatchAccepted(true);
    }
  }, [matchData, matchAccepted]);

  const declineMatch = useCallback(() => {
    const socket = socketRef.current;
    const currentBattleId = matchData?.battleId;
    if (socket && currentBattleId) {
      socket.emit("pvp-team:match:decline", { battleId: currentBattleId });
    }
    resetMatchState();
    setBattleId(null);

    disconnectSocket();
  }, [matchData, resetMatchState, disconnectSocket]);

  const sendInvite = useCallback(
    (targetUserId: string) => {
      const socket = getSocket();
      setInviteError(null);
      setInviteSent(false);
      socket.emit("pvp-team:invite:send", { targetUserId });
    },
    [getSocket],
  );

  const acceptInvite = useCallback(
    (inviteId: string) => {
      const socket = getSocket();
      socket.emit("pvp-team:invite:accept", { inviteId });
      setPendingInvite(null);
    },
    [getSocket],
  );

  const declineInvite = useCallback(
    (inviteId: string) => {
      const socket = getSocket();
      socket.emit("pvp-team:invite:decline", { inviteId });
      setPendingInvite(null);
    },
    [getSocket],
  );

  const clearInviteError = useCallback(() => {
    setInviteError(null);
  }, []);

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

  const reconnectSocket = useCallback((): Promise<Socket> => {
    const existing = socketRef.current;

    if (existing && existing.connected) {
      return Promise.resolve(existing);
    }

    if (existing) {
      return new Promise<Socket>((resolve) => {
        existing.once("connect", () => resolve(existing));
        existing.connect();
      });
    }

    return new Promise<Socket>((resolve) => {
      const socket = getSocket();
      if (socket.connected) {
        resolve(socket);
      } else {
        socket.once("connect", () => resolve(socket));
      }
    });
  }, [getSocket]);

  const value: PvpTeamQueueContextValue = {
    connected,
    inQueue,
    isDuoQueue,
    queuePosition,
    queueSize,
    queueTimeRemaining,
    matchFound,
    matchData,
    matchAcceptTimeRemaining,
    matchAccepted,
    matchAcceptedCount,
    battleStarted,
    battleId,
    pendingInvite,
    inviteSent,
    inviteError,
    getSocket: getSocketRef,
    reconnectSocket,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    sendInvite,
    acceptInvite,
    declineInvite,
    clearInviteError,
  };

  return (
    <PvpTeamQueueContext.Provider value={value}>
      {children}
    </PvpTeamQueueContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePvpTeamQueue(): PvpTeamQueueContextValue {
  const context = useContext(PvpTeamQueueContext);
  if (context === null) {
    throw new Error(
      "usePvpTeamQueue must be used within a PvpTeamQueueProvider",
    );
  }
  return context;
}
