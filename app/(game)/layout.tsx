"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { House, HouseName } from "@/types/house";
import type { Character } from "@/types/character";
import { applyHouseTheme } from "@/lib/theme";
import { clearAuthAndRedirect } from "@/lib/client-auth";
import { useMusicPlayer } from "./_hooks/useMusicPlayer";
import { BossQueueProvider } from "./_hooks/useBossQueue";
import BossQueueBar from "./_components/BossQueueBar";
import BossMatchModal from "./_components/BossMatchModal";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/character", label: "Personagem" },
  { href: "/battle", label: "Batalha" },
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

  const musicContext = (pathname.startsWith("/battle") || pathname.startsWith("/boss-fight")) ? "battle" : "ambient";
  const music = useMusicPlayer(musicContext);

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

  function handleLogout() {
    clearAuthAndRedirect(router);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo + Hamburger (mobile) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="cursor-pointer text-gray-400 transition-colors hover:text-white lg:hidden"
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

            <span className="text-xl font-bold tracking-tight text-white">
              <span className="text-[var(--accent-primary)]">Craft</span> Mind
            </span>
          </div>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors hover:text-white ${
                  pathname === link.href
                    ? "border-b-2 border-[var(--accent-primary)] pb-0.5 text-white"
                    : "text-gray-400"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User info + Logout (desktop) */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--border-subtle)]" />
            ) : user ? (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="text-sm font-medium text-gray-200">
                    {user.name}
                  </span>
                  {user.house && (
                    <span className="rounded-md bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-[var(--accent-primary)]" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                      {HOUSE_DISPLAY[user.house.name] ?? user.house.name}
                    </span>
                  )}
                </div>
                {/* Volume control */}
                <div className="hidden items-center gap-1.5 sm:flex">
                  <button
                    onClick={music.toggleMute}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[var(--bg-secondary)] hover:text-white"
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
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[var(--border-subtle)] accent-[var(--accent-primary)]"
                  />
                </div>

                <button
                  onClick={handleLogout}
                  className="hidden cursor-pointer rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-400 lg:block"
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
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile slide-in menu */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] transition-transform duration-300 ease-in-out lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Menu header */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <span className="text-lg font-bold tracking-tight text-white">
            <span className="text-[var(--accent-primary)]">Craft</span> Mind
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="cursor-pointer text-gray-400 transition-colors hover:text-white"
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
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Menu user info + logout */}
        {user && (
          <div className="mt-auto border-t border-[var(--border-subtle)] px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">
                {user.name}
              </span>
              {user.house && (
                <span className="rounded-md bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-[var(--accent-primary)]" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                  {HOUSE_DISPLAY[user.house.name] ?? user.house.name}
                </span>
              )}
            </div>
            {/* Volume control mobile */}
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={music.toggleMute}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:text-white"
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
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border-subtle)] accent-[var(--accent-primary)]"
              />
            </div>

            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="w-full cursor-pointer rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              Sair
            </button>
          </div>
        )}
      </aside>

      {/* Main content + Boss Queue overlay */}
      <BossQueueProvider>
        <main className="mx-auto max-w-6xl px-4 pt-20 pb-20">{children}</main>
        <BossQueueBar />
        <BossMatchModal />
      </BossQueueProvider>
    </div>
  );
}
