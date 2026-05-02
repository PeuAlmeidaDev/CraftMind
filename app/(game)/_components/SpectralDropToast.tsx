"use client";

// SpectralDropToast — Toast global emitido quando alguem dropa um Cristal
// Espectral (purity 100). Listener no evento Socket.io `global:spectral-drop`.
//
// Convencoes:
// - Filtra eventos onde payload.userId === currentUserId (o dropper ja ve via
//   CardDropReveal na propria tela de batalha).
// - Queue interna: max 3 toasts visiveis simultaneamente, FIFO.
// - TTL: 8s por toast (auto-dismiss).
// - Posicao: top-right, slide-in via CSS keyframes (sem libs).
// - Sem som por design (decisao do produto).
//
// Uso: incluido uma unica vez em `(game)/layout.tsx` consumindo o socket
// compartilhado via `useLayoutSocket`.

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { SpectralDropBroadcast } from "@/types/cards";

type Props = {
  socket: Socket | null;
  /** ID do usuario atual — usado para filtrar o proprio drop. Null durante
   *  o boot (ainda nao carregou perfil). Toasts so aparecem quando definido. */
  currentUserId: string | null;
};

const TOAST_TTL_MS = 8000;
const MAX_VISIBLE = 3;

type QueuedToast = SpectralDropBroadcast & {
  /** ID interno do toast (incremental). */
  toastId: number;
};

export default function SpectralDropToast({ socket, currentUserId }: Props) {
  const [visible, setVisible] = useState<QueuedToast[]>([]);
  const queueRef = useRef<QueuedToast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Type guard: payload do socket precisa ter os 4 campos string.
  function isSpectralDrop(value: unknown): value is SpectralDropBroadcast {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v.userId === "string" &&
      typeof v.userName === "string" &&
      typeof v.cardName === "string" &&
      typeof v.mobName === "string"
    );
  }

  useEffect(() => {
    if (!socket) return;

    const handle = (payload: unknown) => {
      if (!isSpectralDrop(payload)) return;
      // Filtro: nao mostrar pro proprio dropper.
      if (currentUserId && payload.userId === currentUserId) return;

      const toastId = ++counterRef.current;
      const queued: QueuedToast = { ...payload, toastId };

      setVisible((prev) => {
        if (prev.length < MAX_VISIBLE) {
          return [...prev, queued];
        }
        // Cheio — enfileira.
        queueRef.current.push(queued);
        return prev;
      });
    };

    socket.on("global:spectral-drop", handle);
    return () => {
      socket.off("global:spectral-drop", handle);
    };
  }, [socket, currentUserId]);

  // Auto-dismiss e flush da fila quando um toast cai.
  useEffect(() => {
    for (const toast of visible) {
      if (timersRef.current.has(toast.toastId)) continue;
      const timer = setTimeout(() => {
        timersRef.current.delete(toast.toastId);
        setVisible((prev) => {
          const filtered = prev.filter((t) => t.toastId !== toast.toastId);
          // Promove proximo da fila se houver espaco.
          while (filtered.length < MAX_VISIBLE && queueRef.current.length > 0) {
            const next = queueRef.current.shift();
            if (next) filtered.push(next);
          }
          return filtered;
        });
      }, TOAST_TTL_MS);
      timersRef.current.set(toast.toastId, timer);
    }
  }, [visible]);

  // Cleanup global ao desmontar.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      queueRef.current = [];
    };
  }, []);

  if (visible.length === 0) return null;

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-20 right-4 z-[60] flex flex-col gap-2"
      >
        {visible.map((toast) => (
          <article
            key={toast.toastId}
            className="spectral-toast pointer-events-auto relative flex items-center gap-3 px-4 py-3"
            style={{
              minWidth: 280,
              maxWidth: 360,
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--gold) 12%, var(--bg-card)) 0%, var(--bg-primary) 100%)",
              border: "1px solid color-mix(in srgb, var(--gold) 60%, transparent)",
              boxShadow:
                "0 8px 24px color-mix(in srgb, var(--gold) 25%, transparent), 0 0 0 1px color-mix(in srgb, var(--gold) 20%, transparent) inset",
            }}
          >
            {/* Icone de cristal */}
            <span
              aria-hidden="true"
              className="spectral-toast-icon shrink-0"
              style={{
                width: 28,
                height: 28,
                background:
                  "radial-gradient(circle at 30% 30%, var(--gold) 0%, color-mix(in srgb, var(--gold) 30%, transparent) 60%, transparent 100%)",
                borderRadius: "50%",
                boxShadow: "0 0 12px var(--gold)",
              }}
            />

            <div className="flex min-w-0 flex-col">
              <span
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "var(--gold)",
                }}
              >
                Cristal Espectral
              </span>
              <span
                className="truncate text-[14px] text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                {toast.userName}
              </span>
              <span
                className="truncate text-[11px] italic"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                }}
              >
                {toast.cardName} &mdash; {toast.mobName}
              </span>
            </div>
          </article>
        ))}
      </div>

      <style jsx>{`
        @keyframes spectralToastIn {
          0% {
            transform: translateX(120%);
            opacity: 0;
          }
          70% {
            transform: translateX(-4px);
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes spectralIconPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.08);
          }
        }
        :global(.spectral-toast) {
          animation: spectralToastIn 360ms cubic-bezier(0.18, 0.89, 0.32, 1.28)
            both;
        }
        :global(.spectral-toast-icon) {
          animation: spectralIconPulse 1.6s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
