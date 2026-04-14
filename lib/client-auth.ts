// lib/client-auth.ts — Utilidades de autenticacao compartilhadas entre Client Components
//
// Centraliza getToken e clearAuthAndRedirect para evitar duplicacao
// em dashboard, character, battle, boss-fight, etc.

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Le o access_token do localStorage (fallback para httpOnly cookie). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/** Limpa token local + cookie e redireciona para /login. */
export function clearAuthAndRedirect(router: AppRouterInstance): void {
  localStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; max-age=0; samesite=strict";
  router.push("/login");
}

/**
 * Monta headers padrao para fetches autenticados.
 * Inclui Authorization Bearer como fallback e credentials: "include"
 * para enviar o httpOnly cookie.
 */
export function authFetchOptions(token: string, signal?: AbortSignal): RequestInit {
  return {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
    signal,
  };
}
