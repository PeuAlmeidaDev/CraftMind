"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlayerTask = {
  description: string;
  category: string;
};

type CategoryPlayer = {
  name: string;
  level: number;
  houseName: string | null;
  tasks: PlayerTask[];
  unlockedSkillName: string | null;
};

type CategoryPlayersResponse = {
  data: {
    players: CategoryPlayer[];
    totalCount: number;
  };
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BossQueuePlayersDropdownProps = {
  category: string;
  isOpen: boolean;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null;
}

const STALE_MS = 30_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BossQueuePlayersDropdown({
  category,
  isOpen,
  onClose,
}: BossQueuePlayersDropdownProps) {
  const [players, setPlayers] = useState<CategoryPlayer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);
  const lastCategoryRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchPlayers = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/battle/coop/category-players?category=${encodeURIComponent(category)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        setError("Erro ao buscar jogadores");
        return;
      }

      const json = (await res.json()) as CategoryPlayersResponse;
      setPlayers(json.data.players);
      setTotalCount(json.data.totalCount);
      lastFetchRef.current = Date.now();
      lastCategoryRef.current = category;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Erro de conexao");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (!isOpen) return;

    const isStale = Date.now() - lastFetchRef.current > STALE_MS;
    const categoryChanged = lastCategoryRef.current !== category;

    if (isStale || categoryChanged) {
      fetchPlayers();
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, category, fetchPlayers]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-[64px] left-3 right-3 z-40 max-w-2xl mx-auto">
      <div
        className="rounded-xl border border-[var(--accent-primary)] bg-[var(--bg-secondary)] p-4 shadow-xl shadow-black/50"
        style={{ maxHeight: "60vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">
            Jogadores {category}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            X
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Quem completou todas as metas hoje
        </p>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg bg-[var(--bg-card)] p-3 space-y-2"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--border-subtle)]" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 animate-pulse rounded bg-[var(--border-subtle)]" />
                  <div className="h-5 w-16 animate-pulse rounded bg-[var(--border-subtle)]" />
                </div>
                <div className="h-3 w-40 animate-pulse rounded bg-[var(--border-subtle)]" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-sm text-red-400 text-center py-4">{error}</p>
        )}

        {/* Players list */}
        {!loading && !error && (
          <>
            {players.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum jogador encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div
                    key={`${player.name}-${index}`}
                    className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3"
                  >
                    {/* Player header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white truncate">
                        {player.name}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        Lv.{player.level}
                        {player.houseName ? ` | ${player.houseName}` : ""}
                      </span>
                    </div>

                    {/* Task chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {player.tasks.map((task, taskIdx) => {
                        const isMatch =
                          task.category.toUpperCase() ===
                          category.toUpperCase();
                        return (
                          <span
                            key={`${task.description}-${taskIdx}`}
                            className={`rounded-md px-2 py-0.5 text-[11px] ${
                              isMatch
                                ? "text-blue-400 bg-[var(--bg-card)] border border-blue-500/30"
                                : "text-gray-500 bg-[var(--bg-primary)]"
                            }`}
                          >
                            {task.description}
                          </span>
                        );
                      })}
                    </div>

                    {/* Skill unlock */}
                    {player.unlockedSkillName ? (
                      <p className="text-xs text-amber-400">
                        Desbloqueou:{" "}
                        <span className="font-bold text-orange-400">
                          {player.unlockedSkillName}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600">
                        Nenhuma skill desbloqueada
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {totalCount > 0 && (
              <p className="text-xs text-gray-500 text-center mt-4 pt-3 border-t border-[var(--border-subtle)]">
                {totalCount} jogadores completaram metas {category} hoje
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
