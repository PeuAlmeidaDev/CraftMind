"use client";

// app/(game)/character/[id]/showcase/page.tsx
//
// Vitrine publica de um jogador (qualquer usuario logado pode ver).
// Renderiza ate 6 ShowcaseSlot. Se o id da rota === userId logado, mostra botao
// "Editar vitrine" que abre o ShowcaseEditor.
//
// Client Component porque consome rotas autenticadas via Bearer JWT do
// localStorage (mesmo padrao do resto de /character).

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  authFetchOptions,
  clearAuthAndRedirect,
  getToken,
} from "@/lib/client-auth";
import type {
  ShowcaseResponse,
  UserCardSummary,
} from "@/types/cards";
import ShowcaseSlot from "../../_components/ShowcaseSlot";
import ShowcaseEditor from "../../_components/ShowcaseEditor";

type ProfileLite = { id: string; name: string };

const SHOWCASE_MAX = 6;

export default function ShowcasePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const targetUserId = params.id;

  const [loading, setLoading] = useState(true);
  const [showcase, setShowcase] = useState<ShowcaseResponse>({
    userCardIds: [],
    cards: [],
  });
  const [me, setMe] = useState<ProfileLite | null>(null);
  const [inventory, setInventory] = useState<UserCardSummary[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = me?.id === targetUserId;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const token = getToken();
      if (!token) {
        clearAuthAndRedirect(router);
        return;
      }

      const opts = authFetchOptions(token, controller.signal);

      try {
        const [showcaseRes, profileRes] = await Promise.all([
          fetch(`/api/user/${targetUserId}/showcase`, opts),
          fetch("/api/user/profile", opts),
        ]);

        if (showcaseRes.status === 401 || profileRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!showcaseRes.ok) {
          setError("Nao foi possivel carregar a vitrine.");
          return;
        }

        const showcaseJson = (await showcaseRes.json()) as {
          data: ShowcaseResponse;
        };
        setShowcase(showcaseJson.data);

        if (profileRes.ok) {
          const profileJson = (await profileRes.json()) as {
            data: { id: string; name: string };
          };
          setMe({ id: profileJson.data.id, name: profileJson.data.name });

          // Se for dono, pre-carrega inventario para edicao.
          if (profileJson.data.id === targetUserId) {
            const invRes = await fetch("/api/cards", opts);
            if (invRes.ok) {
              const invJson = (await invRes.json()) as {
                data: { userCards: UserCardSummary[] };
              };
              setInventory(invJson.data.userCards);
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Erro de rede ao carregar a vitrine.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [router, targetUserId]);

  const handleSaved = useCallback(
    async (newIds: string[]) => {
      // Refetch para pegar UserCards completos.
      const token = getToken();
      if (!token) return;
      const res = await fetch(
        `/api/user/${targetUserId}/showcase`,
        authFetchOptions(token),
      );
      if (res.ok) {
        const json = (await res.json()) as { data: ShowcaseResponse };
        setShowcase(json.data);
      } else {
        // Atualizacao otimista do array de IDs (UI fica funcional ate o reload).
        setShowcase((prev) => ({ ...prev, userCardIds: newIds }));
      }
    },
    [targetUserId],
  );

  // Constroi 6 slots fixos (preenchidos + vazios).
  const slots: Array<UserCardSummary | null> = Array.from(
    { length: SHOWCASE_MAX },
    (_, i) => showcase.cards[i] ?? null,
  );

  return (
    <div className="relative">
      <header
        className="mb-5 flex items-baseline justify-between"
        style={{
          borderBottom: "1px solid color-mix(in srgb, var(--gold) 12%, transparent)",
          paddingBottom: 12,
        }}
      >
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.35em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            Vitrine
          </span>
          <h1
            className="text-[24px] text-white"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {isOwner ? "Sua vitrine" : "Cristais em destaque"}
          </h1>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.25em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--bg-primary)",
              background: "var(--gold)",
              border: "1px solid var(--gold)",
            }}
          >
            Editar vitrine
          </button>
        )}
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: SHOWCASE_MAX }, (_, i) => (
            <div
              key={i}
              className="aspect-[3/4] w-full animate-pulse"
              style={{
                background:
                  "color-mix(in srgb, var(--gold) 8%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <p
          className="text-center text-[12px] italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "#ff8a70",
          }}
        >
          {error}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slots.map((card, idx) => (
            <ShowcaseSlot key={idx} card={card} index={idx} />
          ))}
        </div>
      )}

      {isOwner && (
        <ShowcaseEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          inventory={inventory}
          initialSelection={showcase.userCardIds}
          onSaved={handleSaved}
          token={getToken()}
        />
      )}
    </div>
  );
}
