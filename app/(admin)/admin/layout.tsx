"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "./_components/toast";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", exact: true },
  { label: "Skills", href: "/admin/skills", exact: false },
  { label: "Mobs", href: "/admin/mobs", exact: false },
  { label: "Cristais", href: "/admin/cards", exact: false },
  { label: "Usuarios", href: "/admin/users", exact: false },
];

const ADMIN_TOKEN_KEY = "craft-mind-admin-token";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: saved }),
      })
        .then((r) => {
          if (r.ok) setAuthenticated(true);
          else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        })
        .catch(() => {})
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });
    if (res.ok) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput);
      setAuthenticated(true);
    } else {
      setAuthError("Token invalido");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAuthenticated(false);
    setTokenInput("");
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <form onSubmit={handleLogin} className="w-full max-w-sm mx-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8">
          <h1 className="text-xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-sm text-gray-400 mb-6">Insira o token de acesso</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Token"
            autoFocus
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent-primary)] mb-3"
          />
          {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition cursor-pointer"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <span className="text-lg font-bold text-white">Admin</span>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href, item.exact)
                    ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="relative w-60 h-full bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[var(--border-subtle)]">
                <span className="text-lg font-bold text-white">Admin</span>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href, item.exact)
                        ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-white flex-1">Craft Mind Admin</h1>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Sair
            </button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
