"use client";

// ShowcaseEditor — UI do dono pra escolher ate 6 cristais para a vitrine.
//
// Modal simples (sem drag-and-drop) com lista do inventario clicavel: clique
// adiciona/remove. Ordem segue a ordem de selecao. Botao "Salvar" chama
// `PUT /api/user/showcase`.

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CardRarity, UserCardSummary } from "@/types/cards";
import { isSpectral } from "@/lib/cards/purity";

type Props = {
  open: boolean;
  onClose: () => void;
  inventory: UserCardSummary[];
  initialSelection: string[];
  onSaved: (newIds: string[]) => void;
  /** Token JWT para auth do PUT. */
  token: string | null;
};

const SHOWCASE_MAX = 6;

const RARITY_LABEL: Record<CardRarity, string> = {
  COMUM: "Comum",
  INCOMUM: "Incomum",
  RARO: "Raro",
  EPICO: "Epico",
  LENDARIO: "Lendario",
};

export default function ShowcaseEditor({
  open,
  onClose,
  inventory,
  initialSelection,
  onSaved,
  token,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar quando reabre.
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelection);
      setError(null);
    }
  }, [open, initialSelection]);

  // Esc fecha.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const inventoryById = useMemo(() => {
    const m = new Map<string, UserCardSummary>();
    for (const c of inventory) m.set(c.id, c);
    return m;
  }, [inventory]);

  const orderedSelected = useMemo(
    () => selectedIds.map((id) => inventoryById.get(id)).filter((c): c is UserCardSummary => !!c),
    [selectedIds, inventoryById],
  );

  const toggle = useCallback((id: string) => {
    setError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= SHOWCASE_MAX) {
        setError(`Maximo de ${SHOWCASE_MAX} cristais na vitrine.`);
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  async function handleSave() {
    if (!token) {
      setError("Sessao expirada. Entre novamente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/showcase", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userCardIds: selectedIds }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Falha ao salvar a vitrine.");
        return;
      }
      const json = (await res.json()) as { data: { userCardIds: string[] } };
      onSaved(json.data.userCardIds);
      onClose();
    } catch {
      setError("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar vitrine de cristais"
      className="fixed inset-0 z-[80] overflow-y-auto px-4 py-6"
      style={{ background: "rgba(5, 3, 10, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col md:max-h-[85vh] md:overflow-hidden mx-auto md:my-auto"
        style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-baseline justify-between px-5 py-4"
          style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
          }}
        >
          <div>
            <h2
              className="text-[16px] uppercase tracking-[0.25em] text-white"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              Vitrine de Cristais
            </h2>
            <p
              className="text-[10px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              }}
            >
              Escolha ate {SHOWCASE_MAX} cristais para exibir no seu perfil
              publico.
            </p>
          </div>
          <span
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--gold)",
            }}
          >
            {selectedIds.length}/{SHOWCASE_MAX}
          </span>
        </header>

        {/* Pre-visualizacao da ordem selecionada */}
        <div
          className="flex flex-wrap gap-2 px-5 py-3"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
            minHeight: 56,
          }}
        >
          {orderedSelected.length === 0 ? (
            <span
              className="text-[11px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Nenhum selecionado.
            </span>
          ) : (
            orderedSelected.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: isSpectral(c.purity)
                    ? "var(--gold)"
                    : "color-mix(in srgb, var(--gold) 80%, transparent)",
                  border: `1px solid ${isSpectral(c.purity) ? "var(--gold)" : "color-mix(in srgb, var(--gold) 25%, transparent)"}`,
                  background:
                    "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
                }}
                title="Remover desta posicao"
              >
                {idx + 1}. {c.card.mob.name} &times;
              </button>
            ))
          )}
        </div>

        {/* Inventario */}
        <div className="flex-1 md:overflow-y-auto px-5 py-4">
          {inventory.length === 0 ? (
            <p
              className="text-center text-[11px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              }}
            >
              Voce ainda nao possui cristais.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {inventory.map((c) => {
                const selected = selectedIds.includes(c.id);
                const spectral = isSpectral(c.purity);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left transition-colors"
                      style={{
                        background: selected
                          ? "color-mix(in srgb, var(--gold) 10%, var(--bg-primary))"
                          : "var(--bg-primary)",
                        border: selected
                          ? "1px solid var(--gold)"
                          : `1px solid color-mix(in srgb, var(--gold) ${spectral ? 40 : 18}%, transparent)`,
                      }}
                    >
                      <span
                        className="text-[12px] text-white"
                        style={{ fontFamily: "var(--font-cormorant)" }}
                      >
                        {c.card.mob.name}
                      </span>
                      <span
                        className="text-[8px] uppercase tracking-[0.3em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: spectral
                            ? "var(--gold)"
                            : "color-mix(in srgb, var(--gold) 60%, transparent)",
                        }}
                      >
                        {RARITY_LABEL[c.card.rarity]} &middot; Lv {c.level}
                        {spectral ? " ESPECTRAL" : ` ${c.purity}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <footer
          className="sticky bottom-0 z-10 flex items-center justify-between gap-3 px-5 py-4"
          style={{
            background: "linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-card) 100%)",
            borderTop:
              "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
          }}
        >
          {error ? (
            <span
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#ff8a70",
              }}
            >
              {error}
            </span>
          ) : (
            <span
              className="text-[10px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Clique novamente para remover. Esc fecha.
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.25em] disabled:opacity-50"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
                background: "transparent",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.25em] disabled:opacity-50"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--bg-primary)",
                background: "var(--gold)",
                border: "1px solid var(--gold)",
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
