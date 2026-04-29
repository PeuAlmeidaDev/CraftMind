"use client";

import { useState, useEffect, useCallback } from "react";
import type { Friend, FriendRequest } from "@/app/(game)/_hooks/useFriends";
import PlayerSearchBar, { type PlayerPublicProfile } from "./PlayerSearchBar";

type FriendsListProps = {
  open: boolean;
  onClose: () => void;
  friends: Friend[];
  pendingRequests: FriendRequest[];
  pendingCount: number;
  loading: boolean;
  error: string | null;
  acceptRequest: (id: string) => Promise<void>;
  declineRequest: (id: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  refresh: () => void;
  acceptingIds: Set<string>;
  decliningIds: Set<string>;
  removingIds: Set<string>;
  /** Disparado quando o usuario busca um player no header do drawer. */
  onPlayerFound?: (player: PlayerPublicProfile) => void;
};

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

const HOUSE_BANNER: Record<string, string> = {
  ARION: "/houses/Arion/arion-bandeira.png",
  LYCUS: "/houses/Lycus/lycus-bandeira.png",
  NOCTIS: "/houses/Noctis/noctis-bandeira.png",
  NEREID: "/houses/Nereid/nereid-bandeira.png",
};

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#ffffff",
      }}
    />
  );
}

function HouseBadge({ houseName }: { houseName: string | null }) {
  if (!houseName) return null;
  return (
    <span
      className="rounded-md bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-[var(--accent-primary)]"
      style={{ fontFamily: "var(--font-cinzel), serif" }}
    >
      {HOUSE_DISPLAY[houseName] ?? houseName}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
      <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--border-subtle)]" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-24 animate-pulse rounded bg-[var(--border-subtle)]" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--border-subtle)]" />
      </div>
    </div>
  );
}

function RequestItem({
  request,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  request: FriendRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  accepting: boolean;
  declining: boolean;
}) {
  const busy = accepting || declining;
  const initial = request.sender.name.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-3">
      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/20 text-sm font-bold text-[var(--accent-primary)]">
        {initial}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">
            {request.sender.name}
          </span>
          <HouseBadge houseName={request.sender.houseName} />
        </div>
        <span className="text-xs text-white/50">
          Lv. {request.sender.level}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAccept(request.id)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-emerald-400 transition-colors hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-50"
          title="Aceitar"
        >
          {accepting ? (
            <Spinner size={14} />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecline(request.id)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
          title="Recusar"
        >
          {declining ? (
            <Spinner size={14} />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function FriendItem({
  friend,
  onRemove,
  removing,
}: {
  friend: Friend;
  onRemove: (friendshipId: string) => void;
  removing: boolean;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const initial = friend.user.name.charAt(0).toUpperCase();
  const bannerSrc = friend.user.houseName
    ? HOUSE_BANNER[friend.user.houseName] ?? null
    : null;

  return (
    <div className="relative overflow-hidden flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
      {/* House banner background */}
      {bannerSrc && (
        <img
          src={bannerSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 top-1/2 z-0 h-24 -translate-y-1/2 object-contain opacity-[0.10]"
        />
      )}

      {/* Avatar */}
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/20 text-sm font-bold text-[var(--accent-primary)]">
        {initial}
      </div>

      {/* Info */}
      <div className="relative z-10 flex flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">
            {friend.user.name}
          </span>
          <HouseBadge houseName={friend.user.houseName} />
        </div>
        <span className="text-xs text-white/50">
          Lv. {friend.user.level}
        </span>
      </div>

      {/* Remove button / confirmation */}
      <div className="relative z-10 flex shrink-0 items-center">
        {confirmRemove ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={removing}
              onClick={() => onRemove(friend.friendshipId)}
              className="flex h-7 cursor-pointer items-center rounded-md bg-red-900/40 px-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? <Spinner size={12} /> : "Confirmar"}
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => setConfirmRemove(false)}
              className="flex h-7 cursor-pointer items-center rounded-md border border-[var(--border-subtle)] px-2 text-xs text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Nao
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-900/20 hover:text-red-400"
            title="Remover amigo"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function FriendsList({
  open,
  onClose,
  friends,
  pendingRequests,
  pendingCount,
  loading,
  error,
  acceptRequest,
  declineRequest,
  removeFriend,
  refresh,
  acceptingIds,
  decliningIds,
  removingIds,
  onPlayerFound,
}: FriendsListProps) {

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-[71] flex h-full w-full max-w-sm flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Painel de amigos"
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent-primary)]"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2 className="text-sm font-bold text-white">Amigos</h2>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[0.65rem] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-white"
            aria-label="Fechar painel"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Player search no topo do drawer */}
        {onPlayerFound && (
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-3">
            <PlayerSearchBar
              onPlayerFound={(p) => {
                onPlayerFound(p);
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Error state */}
          {error && (
            <div className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/10 p-4">
              <p className="text-center text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="cursor-pointer rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:brightness-110"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && !error && (
            <div className="flex flex-col gap-3">
              <div className="mb-1 h-3 w-32 animate-pulse rounded bg-[var(--border-subtle)]" />
              <SkeletonRow />
              <SkeletonRow />
              <div className="my-3 border-t border-[var(--border-subtle)]" />
              <div className="mb-1 h-3 w-20 animate-pulse rounded bg-[var(--border-subtle)]" />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {/* Loaded content */}
          {!loading && !error && (
            <>
              {/* Pending requests section */}
              {pendingRequests.length > 0 && (
                <section className="mb-5">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Solicitacoes ({pendingRequests.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {pendingRequests.map((req) => (
                      <RequestItem
                        key={req.id}
                        request={req}
                        onAccept={acceptRequest}
                        onDecline={declineRequest}
                        accepting={acceptingIds.has(req.id)}
                        declining={decliningIds.has(req.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Divider between sections (only if both have content) */}
              {pendingRequests.length > 0 && friends.length > 0 && (
                <div className="mb-5 border-t border-[var(--border-subtle)]" />
              )}

              {/* Friends list */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Amigos ({friends.length})
                </h3>

                {friends.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-white/20"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p className="text-center text-sm text-white/40">
                      Nenhum amigo ainda
                    </p>
                    <p className="text-center text-xs text-white/25">
                      Use a busca para encontrar jogadores e enviar pedidos de amizade
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {friends.map((friend) => (
                      <FriendItem
                        key={friend.friendshipId}
                        friend={friend}
                        onRemove={removeFriend}
                        removing={removingIds.has(friend.friendshipId)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Empty state when both are empty */}
              {pendingRequests.length === 0 && friends.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-1">
                  <p className="text-xs text-white/25">
                    Sem solicitacoes pendentes
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export { type FriendsListProps };
