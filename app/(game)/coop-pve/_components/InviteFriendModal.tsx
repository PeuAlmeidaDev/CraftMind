"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken, authFetchOptions } from "@/lib/client-auth";
import { useLayoutSocket } from "../../_hooks/useLayoutSocket";
import type { CoopPveMode, InviteSlot } from "../../_hooks/useCoopPveQueue";

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
  onCancelInvites: () => void;
  invitePhase: InvitePhase;
  inviteTargetName: string | null;
  invites: InviteSlot[];
  maxInvites: number;
};

export default function InviteFriendModal({
  open,
  onClose,
  mode,
  onInvite,
  onCancelInvites,
  invitePhase,
  inviteTargetName,
  invites,
  maxInvites,
}: InviteFriendModalProps) {
  const layoutSocket = useLayoutSocket();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Listen for online status via layout socket
  useEffect(() => {
    if (!open || !layoutSocket) return;

    const handler = (data: { statuses: Record<string, boolean> }) => {
      setOnlineStatus(data.statuses);
    };

    layoutSocket.on("coop-pve:friends:online-status", handler);

    return () => {
      layoutSocket.off("coop-pve:friends:online-status", handler);
    };
  }, [open, layoutSocket]);

  // Fetch friends and emit online check when modal opens
  useEffect(() => {
    if (!open) return;

    // Reset online status so stale data is not shown
    setOnlineStatus({});

    fetchFriends().then(() => {
      // online-check will be emitted by the effect below once friends are set
    });
  }, [open, fetchFriends]);

  // Emit online check whenever friends list or socket changes, and modal is open
  useEffect(() => {
    if (!open || !layoutSocket || friends.length === 0) return;

    const emitCheck = () => {
      const userIds = friends.map((f) => f.user.id);
      layoutSocket.emit("coop-pve:friends:online-check", { userIds });
    };

    if (layoutSocket.connected) {
      emitCheck();
    } else {
      layoutSocket.once("connect", emitCheck);
      return () => {
        layoutSocket.off("connect", emitCheck);
      };
    }
  }, [layoutSocket, friends, open]);

  if (!open) return null;

  const modeLabel = mode === "2v3" ? "2v3" : mode === "2v5" ? "2v5" : "3v5";

  // Sort: online first
  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = onlineStatus[a.user.id] ? 1 : 0;
    const bOnline = onlineStatus[b.user.id] ? 1 : 0;
    return bOnline - aOnline;
  });

  // IDs already invited (to disable in list)
  const invitedUserIds = new Set(invites.map((s) => s.targetUserId));

  // For single-invite modes, use legacy behavior
  const isSingleInviteMode = maxInvites === 1;

  // Determine modal state
  const allInvitesSent = invites.length >= maxInvites;
  const anyDeclinedOrExpired = invites.some((s) => s.phase === "DECLINED" || s.phase === "EXPIRED");
  const allAccepted = invites.length >= maxInvites && invites.every((s) => s.phase === "ACCEPTED");
  const isWaitingAny = invites.some((s) => s.phase === "SENDING" || s.phase === "WAITING");

  // Legacy compat for single-invite
  const legacyIsWaiting = isSingleInviteMode && (invitePhase === "WAITING" || invitePhase === "SENDING");
  const legacyShowFeedback = isSingleInviteMode && (invitePhase === "DECLINED" || invitePhase === "EXPIRED");

  // Should show friend list?
  const showFriendList = isSingleInviteMode
    ? !legacyIsWaiting && !legacyShowFeedback
    : !allInvitesSent && !anyDeclinedOrExpired;

  // Phase label helper
  const phaseLabel = (phase: InviteSlot["phase"]): string => {
    switch (phase) {
      case "SENDING": return "Enviando...";
      case "WAITING": return "Aguardando...";
      case "ACCEPTED": return "Aceito";
      case "DECLINED": return "Recusado";
      case "EXPIRED": return "Expirado";
    }
  };

  const phaseColor = (phase: InviteSlot["phase"]): string => {
    switch (phase) {
      case "SENDING":
      case "WAITING": return "color-mix(in srgb, var(--gold) 80%, transparent)";
      case "ACCEPTED": return "var(--ember)";
      case "DECLINED": return "#f87171";
      case "EXPIRED": return "#facc15";
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        {/* Modal card */}
        <div
          className="relative w-full max-w-md mx-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl animate-modalIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2
                className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                {maxInvites === 2 ? "Convidar Aliados" : "Convidar Amigo"}
              </h2>
              <p
                className="text-xs"
                style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
              >
                Modo {modeLabel}
                {maxInvites === 2 && (
                  <span className="ml-2">
                    ({invites.length}/{maxInvites} convites)
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[var(--bg-primary)] transition cursor-pointer"
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
            {/* === SINGLE-INVITE MODE: legacy behavior === */}
            {isSingleInviteMode && legacyIsWaiting && inviteTargetName && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-white font-medium">
                  Aguardando resposta de {inviteTargetName}...
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}
                >
                  O convite expira em 30 segundos
                </p>
              </div>
            )}

            {isSingleInviteMode && legacyShowFeedback && (
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

            {/* === MULTI-INVITE MODE (3v5): invite slots banner === */}
            {!isSingleInviteMode && invites.length > 0 && !anyDeclinedOrExpired && (
              <div className="mb-4 space-y-2">
                {invites.map((slot, idx) => (
                  <div
                    key={slot.targetUserId}
                    className="flex items-center justify-between p-3"
                    style={{
                      background: "color-mix(in srgb, var(--bg-primary) 80%, transparent)",
                      border: `1px solid ${slot.phase === "ACCEPTED" ? "var(--ember)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Slot indicator */}
                      <div
                        className="flex h-6 w-6 items-center justify-center text-[10px] font-bold"
                        style={{
                          border: `1px solid ${phaseColor(slot.phase)}`,
                          background: slot.phase === "ACCEPTED" ? "color-mix(in srgb, var(--ember) 20%, transparent)" : "transparent",
                          color: phaseColor(slot.phase),
                        }}
                      >
                        {slot.phase === "ACCEPTED" ? "\u2713" : idx + 1}
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium text-white"
                          style={{ fontFamily: "var(--font-cormorant)" }}
                        >
                          {slot.targetName}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ fontFamily: "var(--font-garamond)", color: phaseColor(slot.phase) }}
                        >
                          {phaseLabel(slot.phase)}
                        </p>
                      </div>
                    </div>
                    {(slot.phase === "SENDING" || slot.phase === "WAITING") && (
                      <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                ))}

                {/* Hint for second invite */}
                {invites.length === 1 && !allInvitesSent && (
                  <p
                    className="text-center text-xs italic mt-2"
                    style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
                  >
                    Selecione o segundo aliado abaixo
                  </p>
                )}

                {/* All sent — waiting for both */}
                {allInvitesSent && !allAccepted && (
                  <div className="mt-3 text-center">
                    <p
                      className="text-xs italic"
                      style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
                    >
                      Aguardando todos os aliados aceitarem...
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onCancelInvites();
                        onClose();
                      }}
                      className="mt-3 w-full cursor-pointer py-2 text-[11px] uppercase tracking-[0.2em] text-red-400 transition hover:bg-red-500/10"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        border: "1px solid color-mix(in srgb, #f87171 30%, transparent)",
                        background: "transparent",
                      }}
                    >
                      Cancelar convites
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* === MULTI-INVITE MODE: Declined/Expired feedback === */}
            {!isSingleInviteMode && anyDeclinedOrExpired && (
              <div className="flex flex-col items-center py-8">
                {invites.some((s) => s.phase === "DECLINED") ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 font-medium">
                      {invites.find((s) => s.phase === "DECLINED")?.targetName ?? "Aliado"} recusou o convite
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}
                    >
                      Todos os convites do grupo foram cancelados
                    </p>
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
                    <p
                      className="text-xs mt-1"
                      style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}
                    >
                      Todos os convites do grupo foram cancelados
                    </p>
                  </>
                )}
              </div>
            )}

            {/* === Friends list (shared for both modes) === */}
            {showFriendList && (
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
                      const alreadyInvited = invitedUserIds.has(friend.user.id);
                      const isDisabled = !isOnline || alreadyInvited;

                      return (
                        <div
                          key={friend.friendshipId}
                          className="flex items-center justify-between p-3"
                          style={{
                            background: "var(--bg-primary)",
                            border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                            opacity: alreadyInvited ? 0.5 : 1,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Online indicator */}
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                isOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-600"
                              }`}
                            />
                            <div>
                              <p
                                className="text-sm font-medium text-white"
                                style={{ fontFamily: "var(--font-cormorant)" }}
                              >
                                {friend.user.name}
                              </p>
                              <p
                                className="text-xs"
                                style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}
                              >
                                Nv. {friend.user.level}
                                {friend.user.houseName && (
                                  <span className="ml-1.5" style={{ color: "var(--accent-primary)" }}>
                                    {friend.user.houseName}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onInvite(friend.user.id, friend.user.name)}
                            disabled={isDisabled}
                            className="px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                            style={{
                              fontFamily: "var(--font-cinzel)",
                              letterSpacing: "0.1em",
                              background: isDisabled
                                ? "color-mix(in srgb, var(--bg-secondary) 50%, transparent)"
                                : "color-mix(in srgb, var(--accent-primary) 15%, transparent)",
                              border: `1px solid ${isDisabled ? "color-mix(in srgb, var(--gold) 14%, transparent)" : "color-mix(in srgb, var(--accent-primary) 30%, transparent)"}`,
                              color: alreadyInvited
                                ? "color-mix(in srgb, var(--gold) 40%, transparent)"
                                : isOnline
                                  ? "var(--accent-primary)"
                                  : "color-mix(in srgb, var(--gold) 30%, transparent)",
                              cursor: isDisabled ? "not-allowed" : "pointer",
                            }}
                          >
                            {alreadyInvited ? "Convidado" : isOnline ? "Convidar" : "Offline"}
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
