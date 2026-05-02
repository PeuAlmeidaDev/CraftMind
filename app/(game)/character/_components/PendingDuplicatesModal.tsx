"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type {
  CardRarity,
  PendingCardDuplicateSummary,
} from "@/types/cards";
import { isSpectral } from "@/lib/cards/purity";

type Props = {
  open: boolean;
  pendings: PendingCardDuplicateSummary[];
  /** Callback ao resolver com sucesso. Caller deve atualizar a lista local. */
  onResolved: (id: string) => void;
  onClose: () => void;
};

const RARITY_LABEL: Record<CardRarity, string> = {
  COMUM: "Comum",
  INCOMUM: "Incomum",
  RARO: "Raro",
  EPICO: "Epico",
  LENDARIO: "Lendario",
};

const RARITY_CLASS: Record<CardRarity, string> = {
  COMUM: "rarity-comum",
  INCOMUM: "rarity-incomum",
  RARO: "rarity-raro",
  EPICO: "rarity-epico",
  LENDARIO: "rarity-lendario",
};

function purityColor(purity: number): string {
  if (purity === 100) return "#f4c45a";
  if (purity >= 95) return "#b06bff";
  if (purity >= 90) return "#6b9dff";
  if (purity >= 70) return "#6bd47a";
  if (purity >= 40) return "#9ba3ad";
  return "#7a7280";
}

function purityLabel(purity: number): string {
  return purity === 100 ? "100% ESPECTRAL" : `${purity}%`;
}

export default function PendingDuplicatesModal({
  open,
  pendings,
  onResolved,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    const timer = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(timer);
    };
  }, [open, handleKeyDown]);

  const sorted = useMemo(
    () => [...pendings].sort((a, b) => b.newPurity - a.newPurity),
    [pendings],
  );

  async function resolve(id: string, decision: "REPLACE" | "CONVERT") {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("access_token")
          : null;
      const res = await fetch(
        `/api/cards/pending-duplicates/${encodeURIComponent(id)}/resolve`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ decision }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Falha ao resolver pendencia.");
        return;
      }
      onResolved(id);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{
        background: "rgba(5, 3, 10, 0.85)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cristais duplicados pendentes"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[720px] flex-col outline-none"
        style={{
          maxHeight: "calc(100vh - 48px)",
          background:
            "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--ember) 40%, transparent)",
          boxShadow:
            "0 30px 80px var(--bg-primary), 0 0 40px color-mix(in srgb, var(--ember) 14%, transparent)",
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.35em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              }}
            >
              {pendings.length} pendencia{pendings.length === 1 ? "" : "s"}
            </div>
            <h2
              className="mt-1 text-[24px] font-medium text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Cristal mais puro encontrado
            </h2>
            <p
              className="mt-1 text-[12px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 65%, transparent)",
              }}
            >
              Substitua a copia atual (perde XP e level) ou converta em XP.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 cursor-pointer items-center justify-center text-lg transition-colors"
            style={{
              fontFamily: "monospace",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
            }}
          >
            &times;
          </button>
        </header>

        {error && (
          <div
            className="border-b px-5 py-2 text-[12px]"
            style={{
              borderColor: "color-mix(in srgb, #d96a52 30%, transparent)",
              color: "#d96a52",
              background: "color-mix(in srgb, #d96a52 8%, transparent)",
            }}
          >
            {error}
          </div>
        )}

        {/* Lista */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {sorted.length === 0 ? (
            <div
              className="py-9 text-center italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Nenhuma pendencia.
            </div>
          ) : (
            sorted.map((p) => {
              const { userCard } = p;
              const { card } = userCard;
              const isBusy = busyId === p.id;
              const newColor = purityColor(p.newPurity);
              const oldColor = purityColor(userCard.purity);
              const newSpectral = isSpectral(p.newPurity);
              const rarityClass = RARITY_CLASS[card.rarity];

              return (
                <div
                  key={p.id}
                  className={`grid items-center gap-3 p-3 ${rarityClass}`}
                  style={{
                    gridTemplateColumns: "60px 1fr auto",
                    background:
                      "color-mix(in srgb, var(--bg-secondary) 53%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--rarity-color) 35%, transparent)",
                    boxShadow: newSpectral
                      ? `0 0 18px ${newColor}`
                      : undefined,
                  }}
                >
                  {/* Mini retrato do mob */}
                  <div
                    className="relative h-[60px] w-[60px] overflow-hidden"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--rarity-color) 50%, transparent)",
                      background:
                        "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
                    }}
                  >
                    {card.mob.imageUrl ? (
                      <Image
                        src={card.mob.imageUrl}
                        alt={card.mob.name}
                        fill
                        sizes="60px"
                        className="object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          fontFamily: "var(--font-cormorant)",
                          color: "var(--rarity-color)",
                          fontSize: 24,
                        }}
                      >
                        {card.mob.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Conteudo */}
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className="px-1.5 py-px text-[8px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--rarity-color)",
                          border:
                            "1px solid color-mix(in srgb, var(--rarity-color) 60%, transparent)",
                        }}
                      >
                        {RARITY_LABEL[card.rarity]}
                      </span>
                      <span
                        className="text-[9px] uppercase tracking-[0.25em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                        }}
                      >
                        T{card.mob.tier}
                      </span>
                    </div>
                    <div
                      className="text-[16px] font-medium text-white"
                      style={{ fontFamily: "var(--font-cormorant)" }}
                    >
                      {card.name}
                    </div>
                    <div
                      className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      <span style={{ color: oldColor }}>
                        Atual {purityLabel(userCard.purity)} (Lv {userCard.level})
                      </span>
                      <span
                        style={{
                          color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                        }}
                      >
                        →
                      </span>
                      <span style={{ color: newColor, fontWeight: 600 }}>
                        Novo {purityLabel(p.newPurity)}
                      </span>
                    </div>
                  </div>

                  {/* Botoes */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => resolve(p.id, "REPLACE")}
                      className="cursor-pointer px-3 py-2 text-[9px] uppercase tracking-[0.3em] text-white transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-px"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        background:
                          "linear-gradient(135deg, var(--accent-primary), var(--ember))",
                        border: "1px solid var(--ember)",
                      }}
                    >
                      Substituir
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => resolve(p.id, "CONVERT")}
                      className="cursor-pointer px-3 py-2 text-[9px] uppercase tracking-[0.3em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:text-white"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                        background: "transparent",
                        border:
                          "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
                      }}
                    >
                      Converter em XP
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
