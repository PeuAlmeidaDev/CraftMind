"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken, authFetchOptions } from "@/lib/client-auth";
import { usePvpTeamQueue } from "../../_hooks/usePvpTeamQueue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HistoryEntry = {
  id: string;
  result: "VICTORY" | "DEFEAT" | "DRAW";
  winnerTeam: number | null;
  myTeam: number;
  turns: number;
  teammates: string[];
  opponents: string[];
  createdAt: string;
};

type PaginationData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type HistoryApiResponse = {
  data: {
    battles: HistoryEntry[];
    pagination: PaginationData;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESULT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  VICTORY: {
    label: "Vitoria",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  DEFEAT: {
    label: "Derrota",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  DRAW: {
    label: "Empate",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PvpTeamLobby() {
  const { joinQueue, inQueue, leaveQueue, queueTimeRemaining } =
    usePvpTeamQueue();

  // History state
  const [battles, setBattles] = useState<HistoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(
    async (page: number) => {
      const token = getToken();
      if (!token) return;

      setLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/battle/pvp-team/history?page=${page}`,
          authFetchOptions(token),
        );
        if (!res.ok) return;

        const json = (await res.json()) as HistoryApiResponse;
        setBattles(json.data.battles);
        setPagination(json.data.pagination);
      } catch {
        // Network error
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchHistory(historyPage);
  }, [historyPage, fetchHistory]);

  const handlePrevPage = (): void => {
    if (historyPage > 1) setHistoryPage((p) => p - 1);
  };

  const handleNextPage = (): void => {
    if (pagination && historyPage < pagination.totalPages) {
      setHistoryPage((p) => p + 1);
    }
  };

  const formatQueueTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          PvP Team 2v2
        </h1>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Junte-se a fila e enfrente outra dupla em batalhas competitivas por
          turnos. Ranking points em jogo!
        </p>
      </div>

      {/* Queue section */}
      <div
        className="rounded-xl border border-[var(--border-subtle)] p-6 text-center"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
        }}
      >
        {inQueue ? (
          <div className="space-y-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
            <p className="text-sm text-gray-300">Procurando partida...</p>
            <p className="text-xs text-gray-500">
              Tempo restante: {formatQueueTime(queueTimeRemaining)}
            </p>
            <button
              type="button"
              onClick={leaveQueue}
              className="cursor-pointer rounded-lg px-6 py-2 text-sm font-medium text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
            >
              Sair da Fila
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Entre na fila solo para ser emparelhado com outros jogadores.
            </p>
            <button
              type="button"
              onClick={joinQueue}
              className="cursor-pointer rounded-lg px-8 py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:brightness-110 transition"
            >
              Entrar na Fila Solo
            </button>
          </div>
        )}
      </div>

      {/* History section */}
      <div>
        <h2
          className="text-lg font-semibold text-white mb-4"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Historico de Batalhas
        </h2>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
          </div>
        ) : battles.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhuma batalha PvP Team encontrada.
          </p>
        ) : (
          <div className="space-y-2">
            {battles.map((battle) => {
              const style = RESULT_STYLE[battle.result] ?? RESULT_STYLE.DRAW;
              return (
                <div
                  key={battle.id}
                  className={`rounded-lg border p-3 ${style.bg}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${style.color}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {formatDate(battle.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      Aliados:{" "}
                      {battle.teammates.length > 0
                        ? battle.teammates.join(", ")
                        : "-"}
                    </span>
                    <span className="text-gray-600">vs</span>
                    <span>
                      {battle.opponents.length > 0
                        ? battle.opponents.join(", ")
                        : "-"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {battle.turns} turnos
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={historyPage <= 1}
              className={`text-xs px-3 py-1.5 rounded-md border border-[var(--border-subtle)] ${
                historyPage <= 1
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:text-white hover:border-[var(--accent-primary)]"
              } text-gray-400 transition`}
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500">
              {historyPage} / {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={historyPage >= pagination.totalPages}
              className={`text-xs px-3 py-1.5 rounded-md border border-[var(--border-subtle)] ${
                historyPage >= pagination.totalPages
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:text-white hover:border-[var(--accent-primary)]"
              } text-gray-400 transition`}
            >
              Proxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
