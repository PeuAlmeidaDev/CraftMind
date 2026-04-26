"use client";

import { usePvpTeamQueue } from "../_hooks/usePvpTeamQueue";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PvpTeamQueueBar() {
  const {
    inQueue,
    isDuoQueue,
    queueSize,
    queueTimeRemaining,
    leaveQueue,
  } = usePvpTeamQueue();

  if (!inQueue) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-3">
      <div
        className="rounded-xl border border-[var(--accent-primary)] p-3 shadow-lg shadow-black/40"
        style={{
          background:
            "linear-gradient(to right, var(--bg-card), #2a1a3e)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-primary)] opacity-75" />
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {isDuoQueue
                  ? "PvP Team 2v2 — Dupla na fila..."
                  : "PvP Team 2v2 — Procurando..."}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {queueSize} jogadores | {formatTime(queueTimeRemaining)}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={leaveQueue}
              className="cursor-pointer rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
