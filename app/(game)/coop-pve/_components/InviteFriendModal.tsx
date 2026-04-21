"use client";

import { useEffect, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken, authFetchOptions } from "@/lib/client-auth";
import type { CoopPveMode } from "../../_hooks/useCoopPveQueue";

type FriendUser = {
  id: string;
  name: string;
  level: number;
  houseName: string | null;
};

type Friend = {
  friendshipId: string;
  user: FriendUser;
};

type InvitePhase = "IDLE" | "SENDING" | "WAITING" | "DECLINED" | "EXPIRED";

type InviteFriendModalProps = {
  open: boolean;
  onClose: () => void;
  mode: CoopPveMode;
  onInvite: (targetUserId: string, targetName: string) => void;
  invitePhase: InvitePhase;
  inviteTargetName: string | null;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

export default function InviteFriendModal({
  open,
  onClose,
  mode,
  onInvite,
  invitePhase,
  inviteTargetName,
}: InviteFriendModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketRef, setSocketRef] = useState<Socket | null>(null);

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/friends", authFetchOptions(token));
      if (!res.ok) {
        setError("Erro ao carregar amigos");
        return;
      }
      const json = (await res.json()) as { data: Friend[] };
      setFriends(json.data ?? []);
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }, []);

  // Socket for online check
  useEffect(() => {
    if (!open) return;

    const token = getToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      forceNew: true,
    });

    socket.on("coop-pve:friends:online-status", (data: { statuses: Record<string, boolean> }) => {
      setOnlineStatus(data.statuses);
    });

    socket.connect();
    setSocketRef(socket);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setSocketRef(null);
    };
  }, [open]);

  // Fetch friends and check online when modal opens
  useEffect(() => {
    if (!open) return;
    fetchFriends();
  }, [open, fetchFriends]);

  // Emit online check when friends are loaded AND socket is connected
  useEffect(() => {
    if (!socketRef || friends.length === 0) return;

    const userIds = friends.map((f) => f.user.id);

    const emitCheck = () => {
      socketRef.emit("coop-pve:friends:online-check", { userIds });
    };

    if (socketRef.connected) {
      emitCheck();
    } else {
      socketRef.once("connect", emitCheck);
    }

    return () => {
      socketRef.off("connect", emitCheck);
    };
  }, [socketRef, friends]);

  if (!open) return null;

  const modeLabel = mode === "2v3" ? "2v3" : "2v5";

  // Sort: online first
  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = onlineStatus[a.user.id] ? 1 : 0;
    const bOnline = onlineStatus[b.user.id] ? 1 : 0;
    return bOnline - aOnline;
  });

  const isWaiting = invitePhase === "WAITING" || invitePhase === "SENDING";
  const showFeedback = invitePhase === "DECLINED" || invitePhase === "EXPIRED";

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        {/* Modal card */}
        <div
          className="relative w-full max-w-md mx-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl animate-modalIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Convidar Amigo</h2>
              <p className="text-xs text-gray-500">Modo {modeLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-[var(--bg-primary)] transition cursor-pointer"
              aria-label="Fechar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            {/* Waiting state */}
            {isWaiting && inviteTargetName && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-white font-medium">
                  Aguardando resposta de {inviteTargetName}...
                </p>
                <p className="text-xs text-gray-500 mt-1">O convite expira em 30 segundos</p>
              </div>
            )}

            {/* Feedback state */}
            {showFeedback && (
              <div className="flex flex-col items-center py-8">
                {invitePhase === "DECLINED" ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 font-medium">Convite recusado</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <p className="text-sm text-yellow-400 font-medium">Convite expirou</p>
                  </>
                )}
              </div>
            )}

            {/* Friends list */}
            {!isWaiting && !showFeedback && (
              <>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-400">{error}</p>
                    <button
                      type="button"
                      onClick={fetchFriends}
                      className="mt-2 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">Nenhum amigo adicionado</p>
                    <p className="text-xs text-gray-500 mt-1">Adicione amigos pela barra de busca</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {sortedFriends.map((friend) => {
                      const isOnline = onlineStatus[friend.user.id] ?? false;
                      return (
                        <div
                          key={friend.friendshipId}
                          className="flex items-center justify-between rounded-lg p-3 bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                        >
                          <div className="flex items-center gap-3">
                            {/* Online indicator */}
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                isOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-600"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-white">{friend.user.name}</p>
                              <p className="text-xs text-gray-500">
                                Nv. {friend.user.level}
                                {friend.user.houseName && (
                                  <span className="ml-1.5 text-[var(--accent-primary)]">
                                    {friend.user.houseName}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onInvite(friend.user.id, friend.user.name)}
                            disabled={!isOnline}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                              isOnline
                                ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/25"
                                : "bg-gray-800/50 text-gray-600 border border-gray-700/50 cursor-not-allowed"
                            }`}
                          >
                            {isOnline ? "Convidar" : "Offline"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modalIn {
          animation: modalIn 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
