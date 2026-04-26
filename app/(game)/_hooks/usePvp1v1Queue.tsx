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
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { getToken } from "@/lib/client-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Pvp1v1QueueContextValue = {
  connected: boolean;
  inQueue: boolean;
  queueTimeRemaining: number;
  battleId: string | null;
  getSocket: () => Socket | null;
  reconnectSocket: () => Promise<Socket>;
  joinQueue: () => void;
  leaveQueue: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const Pvp1v1QueueContext =
  createContext<Pvp1v1QueueContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";
const QUEUE_TIMEOUT_SECONDS = 300;

type CharacterApiSkill = {
  slotIndex: number;
  equipped: boolean;
  skill: {
    id: string;
    name: string;
    description: string;
    tier: number;
    cooldown: number;
    target: string;
    damageType: string | null;
    basePower: number;
    hits: number;
    accuracy: number;
    effects: unknown;
    mastery: string;
  };
};

type CharacterApiResponse = {
  data: {
    character: {
      id: string;
      physicalAtk: number;
      physicalDef: number;
      magicAtk: number;
      magicDef: number;
      hp: number;
      speed: number;
      level: number;
      currentExp: number;
      freePoints: number;
    };
    skills: CharacterApiSkill[];
  };
};

export function Pvp1v1QueueProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connected, setConnected] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueTimeRemaining, setQueueTimeRemaining] = useState(0);
  const [battleId, setBattleId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Timer helpers
  // -------------------------------------------------------------------------

  const clearQueueTimer = useCallback(() => {
    if (queueTimerRef.current !== null) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
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

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const resetQueueState = useCallback(() => {
    setInQueue(false);
    setQueueTimeRemaining(0);
    clearQueueTimer();
  }, [clearQueueTimer]);

  // -------------------------------------------------------------------------
  // Socket connection (lazy)
  // -------------------------------------------------------------------------

  const initSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current;

    const token = getToken();

    const socket = io(SOCKET_URL, {
      auth: { token: token ?? "" },
      autoConnect: false,
      forceNew: true,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // --- Queue events ---

    socket.on("matchmaking:waiting", () => {
      // Server confirmed we are in queue — state already set by joinQueue
    });

    socket.on("matchmaking:found", (data: { battleId: string }) => {
      resetQueueState();
      setBattleId(data.battleId);
    });

    socket.on("matchmaking:error", (data: { message: string }) => {
      console.error("[Pvp1v1Queue] Error:", data.message);
      resetQueueState();
    });

    socket.on("matchmaking:cancelled", () => {
      // Server confirmed cancel — state already reset by leaveQueue
    });

    socketRef.current = socket;
    socket.connect();

    return socket;
  }, [resetQueueState]);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  // -------------------------------------------------------------------------
  // Redirect when battleId is set
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (battleId) {
      router.push(`/pvp-1v1?battleId=${battleId}`);
    }
  }, [battleId, router]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const joinQueue = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    // Fetch character data for matchmaking payload
    try {
      const res = await fetch("/api/character", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) {
        console.error("[Pvp1v1Queue] Failed to fetch character");
        return;
      }

      const json = (await res.json()) as CharacterApiResponse;
      const { character, skills } = json.data;

      const stats = {
        physicalAtk: character.physicalAtk,
        physicalDef: character.physicalDef,
        magicAtk: character.magicAtk,
        magicDef: character.magicDef,
        hp: character.hp,
        speed: character.speed,
      };

      const equippedSkills = skills.map((cs) => ({
        skillId: cs.skill.id,
        slotIndex: cs.slotIndex,
        skill: {
          id: cs.skill.id,
          name: cs.skill.name,
          description: cs.skill.description,
          tier: cs.skill.tier,
          cooldown: cs.skill.cooldown,
          target: cs.skill.target,
          damageType: cs.skill.damageType,
          basePower: cs.skill.basePower,
          hits: cs.skill.hits,
          accuracy: cs.skill.accuracy,
          effects: cs.skill.effects,
          mastery: cs.skill.mastery,
        },
      }));

      const socket = initSocket();
      socket.emit("matchmaking:join", {
        characterId: character.id,
        stats,
        skills: equippedSkills,
      });

      setInQueue(true);
      startQueueTimer();
    } catch (err) {
      console.error("[Pvp1v1Queue] Error joining queue:", err);
    }
  }, [initSocket, startQueueTimer]);

  const leaveQueue = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("matchmaking:cancel");
    }
    resetQueueState();

    if (!battleId) {
      disconnectSocket();
    }
  }, [resetQueueState, disconnectSocket, battleId]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      clearQueueTimer();
      disconnectSocket();
    };
  }, [clearQueueTimer, disconnectSocket]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const getSocket = useCallback((): Socket | null => {
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
      const socket = initSocket();
      if (socket.connected) {
        resolve(socket);
      } else {
        socket.once("connect", () => resolve(socket));
      }
    });
  }, [initSocket]);

  const value: Pvp1v1QueueContextValue = {
    connected,
    inQueue,
    queueTimeRemaining,
    battleId,
    getSocket,
    reconnectSocket,
    joinQueue,
    leaveQueue,
  };

  return (
    <Pvp1v1QueueContext.Provider value={value}>
      {children}
    </Pvp1v1QueueContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePvp1v1Queue(): Pvp1v1QueueContextValue {
  const context = useContext(Pvp1v1QueueContext);
  if (context === null) {
    throw new Error(
      "usePvp1v1Queue must be used within a Pvp1v1QueueProvider",
    );
  }
  return context;
}
