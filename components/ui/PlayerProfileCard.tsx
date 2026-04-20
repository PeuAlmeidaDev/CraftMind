"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { getHouseAssets } from "@/lib/houses/house-assets";
import { getToken } from "@/lib/client-auth";
import type { PlayerPublicProfile } from "./PlayerSearchBar";
import type { HouseName } from "@/types/house";

type FriendshipDirection = "SENT" | "RECEIVED";
type FriendshipStatus = "NONE" | "PENDING" | "ACCEPTED";

type FriendshipStatusResponse = {
  data: {
    status: FriendshipStatus;
    friendshipId?: string;
    direction?: FriendshipDirection;
  };
};

type PlayerProfileCardProps = {
  player: PlayerPublicProfile;
  onClose: () => void;
};

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

const STAT_LABELS: { key: keyof PlayerPublicProfile["character"]; label: string }[] = [
  { key: "physicalAtk", label: "ATK Fisico" },
  { key: "physicalDef", label: "DEF Fisica" },
  { key: "magicAtk", label: "ATK Magico" },
  { key: "magicDef", label: "DEF Magica" },
  { key: "hp", label: "HP" },
  { key: "speed", label: "Velocidade" },
];

export default function PlayerProfileCard({
  player,
  onClose,
}: PlayerProfileCardProps) {
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>("NONE");
  const [friendDirection, setFriendDirection] = useState<FriendshipDirection | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Fetch friendship status on mount
  useEffect(() => {
    async function fetchFriendshipStatus() {
      const token = getToken();
      if (!token) {
        setStatusLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/friends/status/${player.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });

        if (res.ok) {
          const json = (await res.json()) as FriendshipStatusResponse;
          setFriendStatus(json.data.status);
          setFriendDirection(json.data.direction ?? null);
          setFriendshipId(json.data.friendshipId ?? null);
        }
      } catch {
        // Silently fail — button defaults to NONE
      } finally {
        setStatusLoading(false);
      }
    }

    fetchFriendshipStatus();
  }, [player.id]);

  async function handleSendRequest() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ targetUserId: player.id }),
      });

      if (res.ok) {
        setFriendStatus("PENDING");
        setFriendDirection("SENT");
        return;
      }

      if (res.status === 409) {
        // Friendship already exists — re-fetch to get accurate state
        const statusRes = await fetch(`/api/friends/status/${player.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (statusRes.ok) {
          const json = (await statusRes.json()) as FriendshipStatusResponse;
          setFriendStatus(json.data.status);
          setFriendDirection(json.data.direction ?? null);
          setFriendshipId(json.data.friendshipId ?? null);
        }
        return;
      }

      if (res.status === 429) {
        setActionError("Aguarde antes de tentar novamente");
        return;
      }

      setActionError("Erro ao enviar pedido");
    } catch {
      setActionError("Erro ao enviar pedido");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptRequest() {
    if (!friendshipId) return;
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/friends/request/${friendshipId}/accept`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        setFriendStatus("ACCEPTED");
        setFriendDirection(null);
        return;
      }

      setActionError("Erro ao aceitar pedido");
    } catch {
      setActionError("Erro ao aceitar pedido");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineRequest() {
    if (!friendshipId) return;
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/friends/request/${friendshipId}/decline`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        setFriendStatus("NONE");
        setFriendDirection(null);
        setFriendshipId(null);
        return;
      }

      setActionError("Erro ao recusar pedido");
    } catch {
      setActionError("Erro ao recusar pedido");
    } finally {
      setActionLoading(false);
    }
  }

  const initial = player.name.charAt(0).toUpperCase();
  const houseAssets = player.house
    ? getHouseAssets(player.house.name as HouseName)
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${player.name}`}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* House emblem background */}
        {houseAssets && (
          <Image
            src={houseAssets.bandeira}
            alt=""
            width={120}
            height={200}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.15]"
            aria-hidden="true"
          />
        )}

        {/* Header: Avatar + Name + House + Level + Emblem */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt={`Avatar de ${player.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--accent-primary)]/20 text-xl font-bold text-[var(--accent-primary)]">
                {initial}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {player.name}
              </span>
              {player.house && (
                <span
                  className="rounded-md bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-[var(--accent-primary)]"
                  style={{ fontFamily: "var(--font-cinzel), serif" }}
                >
                  {HOUSE_DISPLAY[player.house.name] ?? player.house.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-sm font-bold text-white">
                {player.character.level}
              </div>
              <span className="text-xs text-white/50">
                Level {player.character.level}
              </span>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[var(--border-subtle)]" />

        {/* Attributes Grid */}
        <div className="grid grid-cols-2 gap-2">
          {STAT_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"
            >
              <span className="text-xs text-white/60">{label}</span>
              <span className="text-sm font-bold text-white">
                {player.character[key]}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[var(--border-subtle)]" />

        {/* PvP Stats */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/80">
            Estatisticas PvP
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {([
              { label: "Batalhas", value: player.pvpStats.totalBattles },
              { label: "Vitorias", value: player.pvpStats.wins },
              { label: "Derrotas", value: player.pvpStats.losses },
              { label: "Empates", value: player.pvpStats.draws },
            ] as const).map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-bold text-white">
                  {stat.value}
                </span>
                <span className="text-[0.65rem] text-white/50">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[var(--border-subtle)]" />

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {actionError && (
            <p className="text-center text-xs" style={{ color: "#f87171" }}>
              {actionError}
            </p>
          )}

          {statusLoading ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white opacity-60 cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
              }}
            >
              <div
                className="animate-spin rounded-full"
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#ffffff",
                }}
              />
              Carregando...
            </button>
          ) : friendStatus === "ACCEPTED" ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-3 py-2 text-sm font-medium text-emerald-400 cursor-not-allowed"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Amigos
            </button>
          ) : friendStatus === "PENDING" && friendDirection === "SENT" ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white opacity-60 cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
              }}
            >
              <svg
                width="16"
                height="16"
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
              Pedido Enviado
            </button>
          ) : friendStatus === "PENDING" && friendDirection === "RECEIVED" ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleAcceptRequest}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
                }}
              >
                {actionLoading ? (
                  <div
                    className="animate-spin rounded-full"
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#ffffff",
                    }}
                  />
                ) : (
                  "Aceitar Pedido"
                )}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeclineRequest}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-[var(--accent-primary)]/40 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Recusar
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleSendRequest}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
              }}
            >
              {actionLoading ? (
                <div
                  className="animate-spin rounded-full"
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#ffffff",
                  }}
                />
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
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
                  Adicionar Amigo
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-[var(--accent-primary)]/40 hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
