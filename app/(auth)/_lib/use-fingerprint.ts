"use client";

// app/(auth)/_lib/use-fingerprint.ts — Hook para obter visitorId estavel via FingerprintJS
//
// - Carrega FingerprintJS via dynamic import no useEffect (nao bloqueia render).
// - Cacheia o visitorId em localStorage["cm:visitorId"] para reusar entre sessoes.
// - Em qualquer falha (ad blocker, lib bloqueada, timeout): retorna "unknown" + ready=true.
// - Nunca lanca exception pro componente.

import { useEffect, useState } from "react";

const STORAGE_KEY = "cm:visitorId";
const UNKNOWN = "unknown";

export type FingerprintState = {
  visitorId: string;
  ready: boolean;
};

export function useFingerprint(): FingerprintState {
  const [state, setState] = useState<FingerprintState>({
    visitorId: UNKNOWN,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    // 1) Tenta cache no localStorage
    try {
      const cached = window.localStorage.getItem(STORAGE_KEY);
      if (cached && cached.length > 0 && cached !== UNKNOWN) {
        setState({ visitorId: cached, ready: true });
        return () => {
          cancelled = true;
        };
      }
    } catch {
      // localStorage pode lancar (modo privado de alguns browsers). Ignora.
    }

    // 2) Carrega FingerprintJS via dynamic import
    (async () => {
      try {
        const mod = await import("@fingerprintjs/fingerprintjs");
        const FingerprintJS = mod.default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();

        if (cancelled) return;

        const id = typeof result.visitorId === "string" && result.visitorId.length > 0
          ? result.visitorId
          : UNKNOWN;

        try {
          window.localStorage.setItem(STORAGE_KEY, id);
        } catch {
          // ignora falha de localStorage
        }

        setState({ visitorId: id, ready: true });
      } catch {
        if (cancelled) return;
        // Qualquer erro (ad blocker, JS error, network) -> fallback "unknown".
        setState({ visitorId: UNKNOWN, ready: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
