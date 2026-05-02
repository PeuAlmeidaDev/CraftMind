"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { House, HouseName } from "@/types/house";
import type { Character } from "@/types/character";
import { applyHouseTheme } from "@/lib/theme";
import { clearAuthAndRedirect } from "@/lib/client-auth";
import { io, type Socket } from "socket.io-client";
import { useMusicPlayer } from "./_hooks/useMusicPlayer";
import { useFriends } from "./_hooks/useFriends";
import { BossQueueProvider } from "./_hooks/useBossQueue";
import { PvpTeamQueueProvider } from "./_hooks/usePvpTeamQueue";
import { Pvp1v1QueueProvider } from "./_hooks/usePvp1v1Queue";
import BossQueueBar from "./_components/BossQueueBar";
import BossMatchModal from "./_components/BossMatchModal";
import PvpTeamQueueBar from "./_components/PvpTeamQueueBar";
import PvpTeamMatchModal from "./_components/PvpTeamMatchModal";
import Pvp1v1QueueBar from "./_components/Pvp1v1QueueBar";
import PvpTeamInviteNotification from "./_components/PvpTeamInviteNotification";
import CoopPveInviteNotification from "./_components/CoopPveInviteNotification";
import SpectralDropToast from "./_components/SpectralDropToast";
import { LayoutSocketProvider } from "./_hooks/useLayoutSocket";
import PlayerSearchBar from "@/components/ui/PlayerSearchBar";
import PlayerProfileCard from "@/components/ui/PlayerProfileCard";
import FriendsList from "@/components/ui/FriendsList";
import type { PlayerPublicProfile } from "@/components/ui/PlayerSearchBar";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/character", label: "Personagem" },
  { href: "/battle", label: "Batalha" },
  { href: "/bestiary", label: "Bestiario" },
  { href: "/ranking", label: "Ranking" },
] as const;

type UserProfile = {
  id: string;
  name: string;
  email: string;
  house: Pick<House, "name" | "animal" | "description"> | null;
  character: Character | null;
};

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [searchedPlayer, setSearchedPlayer] = useState<PlayerPublicProfile | null>(null);
  const layoutSocketRef = useRef<Socket | null>(null);
  const [layoutSocket, setLayoutSocket] = useState<Socket | null>(null);

  const musicContext = (pathname.startsWith("/battle") || pathname.startsWith("/boss-fight") || pathname.startsWith("/pvp-team") || pathname.startsWith("/pvp-1v1")) ? "battle" : "ambient";
  const music = useMusicPlayer(musicContext);

  const {
    friends,
    pendingRequests,
    pendingCount,
    loading: friendsLoading,
    error: friendsError,
    acceptRequest,
    declineRequest,
    removeFriend,
    refresh: refreshFriends,
    acceptingIds,
    decliningIds,
    removingIds,
  } = useFriends();

  const fetchProfile = useCallback(
    async (signal?: AbortSignal) => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        clearAuthAndRedirect(router);
        return;
      }

      try {
        const res = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          signal,
        });

        if (signal?.aborted) return;

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = (await res.json()) as { data: UserProfile };
        if (signal?.aborted) return;

        setUser(json.data);

        if (json.data.house?.name) {
          applyHouseTheme(json.data.house.name as HouseName);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Erro de rede -- manter na pagina mas sem dados
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(controller.signal);
    return () => controller.abort();
  }, [fetchProfile]);

  // Socket.io para eventos de amizade em tempo real
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) return;

    const socket: Socket = io(socketUrl, {
      auth: { token },
      autoConnect: false,
    });

    socket.on("friend:request-received", () => {
      refreshFriends();
    });

    socket.on("friend:request-accepted", () => {
      refreshFriends();
    });

    // Anti multi-account: outra aba/dispositivo logou na mesma conta.
    // Servidor desconecta esta sessao depois de emitir o evento.
    socket.on("session:replaced", (payload: { reason?: string }) => {
      const reason =
        typeof payload?.reason === "string" && payload.reason.length > 0
          ? payload.reason
          : "Sua conta foi acessada em outro dispositivo.";
      console.warn("[Socket.io] session:replaced ->", reason);
      // Sem toast lib instalada: alert garante feedback visivel ao usuario.
      if (typeof window !== "undefined") {
        window.alert(reason);
      }
      clearAuthAndRedirect(router);
    });

    socket.connect();
    layoutSocketRef.current = socket;
    setLayoutSocket(socket);

    return () => {
      socket.disconnect();
      layoutSocketRef.current = null;
      setLayoutSocket(null);
    };
  }, [refreshFriends, router]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Continuar com logout local mesmo se a API falhar
    }
    clearAuthAndRedirect(router);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header
        className="fixed top-0 right-0 left-0 z-50 backdrop-blur-sm"
        style={{
          background: "linear-gradient(to right, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 95%, transparent))",
          borderBottom: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo + Hamburger (mobile) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="cursor-pointer transition-colors hover:text-white lg:hidden"
              style={{ color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
              aria-label="Abrir menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <span
              className="text-[22px] font-medium italic text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              <span style={{ color: "var(--ember)" }}>Craft</span> Mind
            </span>
          </div>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[10px] uppercase transition-colors tracking-[0.25em] hover:text-white ${
                  pathname === link.href
                    ? "border-b-2 border-b-[var(--ember)] pb-1 text-white"
                    : ""
                }`}
                style={{
                  fontFamily: "var(--font-cinzel)",
                  ...(pathname !== link.href
                    ? { color: "color-mix(in srgb, var(--gold) 60%, transparent)" }
                    : {}),
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User info + Logout (desktop) */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-5 w-32 animate-pulse bg-[var(--border-subtle)]" />
            ) : user ? (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <span
                    className="text-[14px] text-white"
                    style={{ fontFamily: "var(--font-cormorant)" }}
                  >
                    {user.name}
                  </span>
                  {user.house && (
                    <span
                      className="px-2.5 py-0.5 text-[8px] font-semibold tracking-[0.3em] uppercase text-[var(--accent-primary)]"
                      style={{
                        fontFamily: "var(--font-cinzel), serif",
                        background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                      }}
                    >
                      {HOUSE_DISPLAY[user.house.name] ?? user.house.name}
                    </span>
                  )}
                </div>
                {/* Volume control */}
                <div className="hidden items-center gap-1.5 sm:flex">
                  <button
                    onClick={music.toggleMute}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--bg-secondary)] hover:text-white"
                    style={{
                      color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                    }}
                    title={music.muted ? "Ativar som" : "Mutar"}
                  >
                    {music.muted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={music.muted ? 0 : Math.round(music.volume * 100)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) / 100;
                      music.setVolume(v);
                      if (music.muted && v > 0) music.toggleMute();
                    }}
                    className="h-1 w-16 cursor-pointer appearance-none bg-[var(--border-subtle)] accent-[var(--ember)]"
                  />
                </div>

                <Link
                  href="/codex"
                  className="hidden h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--bg-secondary)] hover:text-white lg:flex"
                  style={{
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                  }}
                  title="Codex de Combate"
                  aria-label="Abrir Codex de Combate"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden cursor-pointer px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] transition-colors hover:border-[#d96a52]/60 hover:text-[#d96a52] lg:block"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    border: "1px solid color-mix(in srgb, #d96a52 30%, transparent)",
                    color: "color-mix(in srgb, #d96a52 60%, transparent)",
                  }}
                >
                  Sair
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-sm lg:hidden"
          style={{ background: "rgba(5,3,10,0.7)" }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile slide-in menu */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-[var(--bg-secondary)] transition-transform duration-300 ease-in-out lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          borderRight: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
        }}
      >
        {/* Menu header */}
        <div
          className="flex h-14 items-center justify-between px-4"
          style={{
            borderBottom: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
          }}
        >
          <span
            className="text-lg font-medium italic text-white"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            <span style={{ color: "var(--ember)" }}>Craft</span> Mind
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="cursor-pointer transition-colors hover:text-white"
            style={{ color: "color-mix(in srgb, var(--gold) 60%, transparent)" }}
            aria-label="Fechar menu"
          >
            <svg
              width="20"
              height="20"
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

        {/* Menu nav links */}
        <nav className="flex flex-col gap-1 px-3 pt-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                pathname === link.href
                  ? "text-[var(--ember)]"
                  : "hover:text-white"
              }`}
              style={{
                fontFamily: "var(--font-cinzel)",
                ...(pathname === link.href
                  ? {
                      background: "color-mix(in srgb, var(--ember) 8%, transparent)",
                      borderLeft: "2px solid var(--ember)",
                    }
                  : {
                      color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                    }),
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Friends button (mobile) */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setFriendsOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors hover:text-white"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
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
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Amigos</span>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-[var(--ember)] px-1 text-[0.6rem] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <Link
            href="/codex"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors hover:text-white"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
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
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>Codex</span>
          </Link>
        </nav>

        {/* Player search (mobile) */}
        <div className="px-3 pt-3">
          <PlayerSearchBar onPlayerFound={(p) => { setSearchedPlayer(p); setMenuOpen(false); }} />
        </div>

        {/* Menu user info + logout */}
        {user && (
          <div
            className="mt-auto px-4 py-4"
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="text-[14px] text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                {user.name}
              </span>
              {user.house && (
                <span
                  className="px-2.5 py-0.5 text-[8px] font-semibold tracking-[0.3em] uppercase text-[var(--accent-primary)]"
                  style={{
                    fontFamily: "var(--font-cinzel), serif",
                    background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                  }}
                >
                  {HOUSE_DISPLAY[user.house.name] ?? user.house.name}
                </span>
              )}
            </div>
            {/* Volume control mobile */}
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={music.toggleMute}
                className="flex h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:text-white"
                style={{
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                }}
              >
                {music.muted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={music.muted ? 0 : Math.round(music.volume * 100)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10) / 100;
                  music.setVolume(v);
                  if (music.muted && v > 0) music.toggleMute();
                }}
                className="h-1 flex-1 cursor-pointer appearance-none bg-[var(--border-subtle)] accent-[var(--ember)]"
              />
            </div>

            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="w-full cursor-pointer px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] transition-colors hover:border-[#d96a52]/60 hover:text-[#d96a52]"
              style={{
                fontFamily: "var(--font-cinzel)",
                border: "1px solid color-mix(in srgb, #d96a52 30%, transparent)",
                color: "color-mix(in srgb, #d96a52 60%, transparent)",
              }}
            >
              Sair
            </button>
          </div>
        )}
      </aside>

      {/* Main content + Boss Queue overlay */}
      <LayoutSocketProvider value={layoutSocket}>
      <BossQueueProvider>
      <PvpTeamQueueProvider>
      <Pvp1v1QueueProvider>
        <main className="mx-auto max-w-6xl px-4 pt-20 pb-20">{children}</main>
        <BossQueueBar />
        <BossMatchModal />
        <PvpTeamQueueBar />
        <PvpTeamMatchModal />
        <PvpTeamInviteNotification />
        <Pvp1v1QueueBar />
      </Pvp1v1QueueProvider>
      </PvpTeamQueueProvider>
      </BossQueueProvider>
      </LayoutSocketProvider>

      {/* Coop PvE invite notification (visible on any page) */}
      <CoopPveInviteNotification socket={layoutSocket} />

      {/* Spectral drop global toast (filtra o proprio dropper via userId) */}
      <SpectralDropToast socket={layoutSocket} currentUserId={user?.id ?? null} />

      {/* Player profile modal */}
      {searchedPlayer && (
        <PlayerProfileCard
          player={searchedPlayer}
          onClose={() => setSearchedPlayer(null)}
        />
      )}

      {/* FAB de amigos / busca de player (apenas desktop) */}
      {user && (
        <button
          type="button"
          onClick={() => setFriendsOpen(true)}
          className="fixed bottom-6 right-6 z-30 hidden h-14 w-14 cursor-pointer items-center justify-center transition-transform hover:scale-105 active:scale-95 lg:flex"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 90%, transparent), color-mix(in srgb, var(--accent-primary) 60%, var(--bg-primary)))",
            border: "1px solid color-mix(in srgb, var(--accent-primary) 70%, transparent)",
            boxShadow:
              "0 8px 22px color-mix(in srgb, var(--accent-primary) 35%, transparent), 0 0 0 1px color-mix(in srgb, var(--gold) 14%, transparent) inset",
            color: "white",
          }}
          aria-label="Abrir painel de amigos"
        >
          <svg
            width="22"
            height="22"
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
          {pendingCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-bold text-white"
              style={{
                background: "var(--ember)",
                border: "1px solid var(--bg-primary)",
                borderRadius: 999,
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>
      )}

      {/* Friends drawer */}
      <FriendsList
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        friends={friends}
        pendingRequests={pendingRequests}
        pendingCount={pendingCount}
        loading={friendsLoading}
        error={friendsError}
        acceptRequest={acceptRequest}
        declineRequest={declineRequest}
        removeFriend={removeFriend}
        refresh={refreshFriends}
        acceptingIds={acceptingIds}
        decliningIds={decliningIds}
        removingIds={removingIds}
        onPlayerFound={(p) => {
          setSearchedPlayer(p);
          setFriendsOpen(false);
        }}
      />
    </div>
  );
}
