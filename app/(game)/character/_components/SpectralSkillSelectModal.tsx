"use client";

// SpectralSkillSelectModal — escolha da skill espectral (5o slot em batalha)
// para um Cristal Espectral (UserCard com purity 100).
//
// Ao abrir: GET /api/cards/[id]/spectral-skill -> { skills, currentSkillId, mobId }
// Ao confirmar: PUT /api/cards/[id]/spectral-skill { skillId } -> { ok, spectralSkillId }
//
// Visual: borda dourada (var(--gold)) sem hex hardcoded, label "ESPECTRAL".
// Reaproveita padrao visual de SkillSelectModal (focus trap, Escape, click backdrop).

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, authFetchOptions } from "@/lib/client-auth";

type MobSkill = {
  id: string;
  name: string;
  description: string;
  tier: number;
  cooldown: number;
  target: string;
  damageType: string;
  basePower: number;
  hits: number;
  accuracy: number;
  slotIndex: number;
};

type Props = {
  open: boolean;
  /** UserCard.id do cristal Espectral. */
  userCardId: string | null;
  /** Skill espectral atualmente selecionada (se houver), para destacar na lista. */
  currentSkillId?: string | null;
  onClose: () => void;
  /** Disparado apos PUT bem-sucedido. Recebe o novo spectralSkillId. */
  onSaved: (spectralSkillId: string) => void;
};

const TIER_COLORS: Record<number, string> = {
  1: "#9ba3ad",
  2: "#6b9dff",
  3: "#b06bff",
};

const TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "Fisico",
  MAGICAL: "Magico",
  NONE: "Suporte",
};

export default function SpectralSkillSelectModal({
  open,
  userCardId,
  currentSkillId,
  onClose,
  onSaved,
}: Props) {
  const [skills, setSkills] = useState<MobSkill[] | null>(null);
  const [serverCurrentId, setServerCurrentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

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

  // Fetch das mob skills sempre que abre com novo userCardId
  useEffect(() => {
    if (!open || !userCardId) {
      setSkills(null);
      setSelectedId(null);
      setServerCurrentId(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      const token = getToken();
      if (!token) {
        setError("Sessao expirada");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/cards/${userCardId}/spectral-skill`,
          authFetchOptions(token, controller.signal),
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(body?.error ?? "Erro ao carregar skills");
          setSkills([]);
          return;
        }
        const json = (await res.json()) as {
          data: { skills: MobSkill[]; currentSkillId: string | null };
        };
        setSkills(json.data.skills);
        setServerCurrentId(json.data.currentSkillId);
        setSelectedId(json.data.currentSkillId ?? currentSkillId ?? null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Erro de rede ao carregar skills");
        setSkills([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, userCardId, currentSkillId]);

  if (!open) return null;

  async function handleSave() {
    if (!userCardId || !selectedId || saving) return;
    const token = getToken();
    if (!token) {
      setError("Sessao expirada");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${userCardId}/spectral-skill`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ skillId: selectedId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "Erro ao salvar skill");
        return;
      }
      const json = (await res.json()) as {
        data: { ok: boolean; spectralSkillId: string };
      };
      onSaved(json.data.spectralSkillId);
      onClose();
    } catch {
      setError("Erro de rede ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-6"
      style={{ background: "rgba(5, 3, 10, 0.82)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spectral-skill-modal-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-2xl focus:outline-none md:my-auto md:max-h-[85vh] md:overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
          border: "1px solid var(--gold)",
          boxShadow:
            "0 0 24px color-mix(in srgb, var(--gold) 30%, transparent), 0 0 48px color-mix(in srgb, var(--gold) 18%, transparent)",
        }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3"
          style={{
            background:
              "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
            borderColor: "color-mix(in srgb, var(--gold) 35%, transparent)",
          }}
        >
          <div>
            <span
              className="block text-[9px] uppercase tracking-[0.4em]"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--gold)",
              }}
            >
              Skill Espectral
            </span>
            <h2
              id="spectral-skill-modal-title"
              className="text-[18px]"
              style={{
                fontFamily: "var(--font-cormorant)",
                color: "var(--gold)",
              }}
            >
              Escolha o 5o slot em batalha
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center text-[18px] transition-colors md:h-auto md:w-auto"
            style={{
              fontFamily: "monospace",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ember)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "color-mix(in srgb, var(--gold) 60%, transparent)";
            }}
          >
            &times;
          </button>
        </header>

        {/* Content */}
        <div className="p-5 md:max-h-[60vh] md:overflow-y-auto">
          {loading && (
            <p
              className="text-center text-[12px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              }}
            >
              Carregando skills do mob...
            </p>
          )}

          {!loading && error && (
            <p
              className="text-center text-[12px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#d96a52",
              }}
            >
              {error}
            </p>
          )}

          {!loading && !error && skills && skills.length === 0 && (
            <p
              className="text-center text-[12px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              }}
            >
              Nenhuma skill disponivel para este mob.
            </p>
          )}

          {!loading && skills && skills.length > 0 && (
            <ul className="flex flex-col gap-2">
              {skills.map((s) => {
                const isSelected = selectedId === s.id;
                const isCurrent = serverCurrentId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className="group relative flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition-colors"
                      style={{
                        background: isSelected
                          ? "color-mix(in srgb, var(--gold) 10%, transparent)"
                          : "color-mix(in srgb, var(--bg-primary) 60%, transparent)",
                        border: isSelected
                          ? "1px solid var(--gold)"
                          : "1px solid color-mix(in srgb, var(--gold) 18%, transparent)",
                        boxShadow: isSelected
                          ? "0 0 12px color-mix(in srgb, var(--gold) 25%, transparent)"
                          : undefined,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-[14px]"
                          style={{
                            fontFamily: "var(--font-cormorant)",
                            color: "var(--gold)",
                          }}
                        >
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {isCurrent && (
                            <span
                              className="text-[8px] uppercase tracking-[0.3em]"
                              style={{
                                fontFamily: "var(--font-cinzel)",
                                color: "var(--gold)",
                                border: "1px solid var(--gold)",
                                padding: "2px 6px",
                              }}
                            >
                              Atual
                            </span>
                          )}
                          <span
                            className="text-[9px] uppercase tracking-[0.25em]"
                            style={{
                              fontFamily: "var(--font-cinzel)",
                              color: TIER_COLORS[s.tier] ?? "var(--gold)",
                            }}
                          >
                            T{s.tier}
                          </span>
                        </div>
                      </div>
                      <div
                        className="text-[10px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                        }}
                      >
                        {TYPE_LABEL[s.damageType] ?? s.damageType} &middot;{" "}
                        Pwr {s.basePower} &middot; Hits {s.hits} &middot; Acc{" "}
                        {s.accuracy}% &middot; CD {s.cooldown}
                      </div>
                      <p
                        className="text-[11px] leading-snug"
                        style={{
                          fontFamily: "var(--font-garamond)",
                          color:
                            "color-mix(in srgb, var(--gold) 78%, transparent)",
                        }}
                      >
                        {s.description}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <footer
          className="flex items-center justify-between gap-3 border-t px-5 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--gold) 35%, transparent)",
          }}
        >
          <span
            className="text-[10px] italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            }}
          >
            Skill ativa enquanto o cristal estiver equipado.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.25em] transition-colors"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
                background: "transparent",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedId || saving}
              className="cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.25em] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--bg-primary)",
                background: "var(--gold)",
                border: "1px solid var(--gold)",
              }}
            >
              {saving ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
