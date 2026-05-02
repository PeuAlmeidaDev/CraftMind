"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authFetchOptions,
  clearAuthAndRedirect,
  getToken,
} from "@/lib/client-auth";
import { CardRarity, type UserCardSummary } from "@/types/cards";
import EmberField from "@/components/ui/EmberField";
import InventoryStats from "./_components/InventoryStats";
import InventoryFilters, {
  type EquippedFilter,
  type PurityFilter,
  type SortOption,
} from "./_components/InventoryFilters";
import InventoryCard from "./_components/InventoryCard";
import InventoryCardModal from "./_components/InventoryCardModal";
import SpectralSkillSelectModal from "../character/_components/SpectralSkillSelectModal";

const ALL_RARITIES: CardRarity[] = [
  CardRarity.COMUM,
  CardRarity.INCOMUM,
  CardRarity.RARO,
  CardRarity.EPICO,
  CardRarity.LENDARIO,
];

const RARITY_RANK: Record<CardRarity, number> = {
  COMUM: 1,
  INCOMUM: 2,
  RARO: 3,
  EPICO: 4,
  LENDARIO: 5,
};

/** Normaliza string para busca case+accent insensitive (NFD + remove diacritics). */
function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Aplica filtro de purity a uma carta. */
function matchesPurity(purity: number, filter: PurityFilter): boolean {
  switch (filter) {
    case "ANY":
      return true;
    case "SPECTRAL":
      return purity === 100;
    case "EXCELLENT":
      return purity >= 95 && purity <= 99;
    case "GREAT":
      return purity >= 90 && purity <= 94;
    case "GOOD":
      return purity >= 70 && purity <= 89;
    case "AVERAGE":
      return purity >= 40 && purity <= 69;
    case "TRASH":
      return purity >= 0 && purity <= 39;
    default:
      return true;
  }
}

/** Aplica filtro de equipada. */
function matchesEquipped(card: UserCardSummary, filter: EquippedFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "EQUIPPED") return card.equipped;
  return !card.equipped;
}

/** Comparador de ordenacao. */
function sortCards(
  a: UserCardSummary,
  b: UserCardSummary,
  sort: SortOption,
): number {
  switch (sort) {
    case "PURITY_DESC":
      return b.purity - a.purity || RARITY_RANK[b.card.rarity] - RARITY_RANK[a.card.rarity];
    case "LEVEL_DESC":
      return b.level - a.level || b.purity - a.purity;
    case "RARITY_DESC":
      return (
        RARITY_RANK[b.card.rarity] - RARITY_RANK[a.card.rarity] ||
        b.purity - a.purity
      );
    case "NAME_ASC":
      return a.card.name.localeCompare(b.card.name, "pt-BR");
    case "RECENT_DESC": {
      // createdAt e opcional no tipo, mas o backend sempre envia. Usamos
      // string compare em ISO 8601 que e equivalente a date compare.
      const ad = a.createdAt ?? "";
      const bd = b.createdAt ?? "";
      if (ad === bd) return 0;
      return ad < bd ? 1 : -1;
    }
    default:
      return 0;
  }
}

export default function InventarioPage() {
  const router = useRouter();
  const [userCards, setUserCards] = useState<UserCardSummary[]>([]);
  const [totalCardsInGame, setTotalCardsInGame] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Filtros
  const [rarities, setRarities] = useState<Set<CardRarity>>(
    () => new Set(ALL_RARITIES),
  );
  const [purity, setPurity] = useState<PurityFilter>("ANY");
  const [equipped, setEquipped] = useState<EquippedFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("PURITY_DESC");

  // Modal de detalhes
  const [selectedCard, setSelectedCard] = useState<UserCardSummary | null>(null);
  const [spectralModalUserCardId, setSpectralModalUserCardId] = useState<
    string | null
  >(null);

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchData() {
      const opts = authFetchOptions(token!, ac.signal);
      try {
        const [cardsRes, totalRes] = await Promise.all([
          fetch("/api/cards", opts),
          fetch("/api/cards/total-count", opts),
        ]);

        if (cardsRes.status === 401 || totalRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (cardsRes.ok) {
          const json = (await cardsRes.json()) as {
            data: { userCards: UserCardSummary[] };
          };
          setUserCards(json.data.userCards);
        } else {
          setError("Nao foi possivel carregar o inventario.");
        }

        if (totalRes.ok) {
          const json = (await totalRes.json()) as {
            data: { totalCards: number };
          };
          setTotalCardsInGame(json.data.totalCards);
        }
        // Falha no total-count nao bloqueia a tela — mostramos "?" como fallback.
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Falha de rede ao carregar o inventario.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchData();
    return () => ac.abort();
  }, [router, retryKey]);

  // Refetch helper usado apos save da skill espectral.
  const refetchCards = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch("/api/cards", authFetchOptions(token));
    if (res.ok) {
      const json = (await res.json()) as {
        data: { userCards: UserCardSummary[] };
      };
      setUserCards(json.data.userCards);
      // Sincroniza o card aberto no modal pra refletir spectralSkillId atualizado.
      setSelectedCard((prev) => {
        if (!prev) return prev;
        return json.data.userCards.find((u) => u.id === prev.id) ?? prev;
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Filtros / ordenacao (memoizado)
  // -----------------------------------------------------------------------

  const filteredAndSorted = useMemo(() => {
    const normSearch = normalizeForSearch(search);
    const filtered = userCards.filter((u) => {
      if (!rarities.has(u.card.rarity)) return false;
      if (!matchesPurity(u.purity, purity)) return false;
      if (!matchesEquipped(u, equipped)) return false;
      if (normSearch.length > 0) {
        const cardName = normalizeForSearch(u.card.name);
        const mobName = normalizeForSearch(u.card.mob.name);
        if (!cardName.includes(normSearch) && !mobName.includes(normSearch)) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => sortCards(a, b, sort));
  }, [userCards, rarities, purity, equipped, search, sort]);

  // -----------------------------------------------------------------------
  // Handlers de filtro
  // -----------------------------------------------------------------------

  function toggleRarity(r: CardRarity) {
    setRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function toggleAllRarities() {
    setRarities((prev) =>
      prev.size === ALL_RARITIES.length ? new Set() : new Set(ALL_RARITIES),
    );
  }

  function resetFilters() {
    setRarities(new Set(ALL_RARITIES));
    setPurity("ANY");
    setEquipped("ALL");
    setSearch("");
    setSort("PURITY_DESC");
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="relative">
      <EmberField />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 15% 8%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0, transparent 55%),
            radial-gradient(ellipse at 88% 92%, color-mix(in srgb, var(--deep) 40%, transparent) 0, transparent 55%)`,
        }}
      />

      <div className="relative z-[2] flex flex-col gap-[18px]">
        {/* Header */}
        <header className="flex flex-col gap-1">
          <h1
            className="text-[28px] font-medium leading-tight text-white sm:text-[34px]"
            style={{ fontFamily: "var(--font-cinzel)", letterSpacing: "0.05em" }}
          >
            Inventario de Cristais
          </h1>
          <p
            className="text-[13px] italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            Sua colecao de Cristais de Memoria
          </p>
        </header>

        {/* Stats globais */}
        <InventoryStats
          userCards={userCards}
          totalCardsInGame={totalCardsInGame}
        />

        {/* Filtros */}
        <InventoryFilters
          rarities={rarities}
          purity={purity}
          equipped={equipped}
          search={search}
          sort={sort}
          onToggleRarity={toggleRarity}
          onToggleAllRarities={toggleAllRarities}
          onPurityChange={setPurity}
          onEquippedChange={setEquipped}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onResetFilters={resetFilters}
        />

        {/* Contador de resultados */}
        {!loading && userCards.length > 0 && (
          <div
            className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            }}
          >
            <span>
              {filteredAndSorted.length} de {userCards.length} cristais
            </span>
          </div>
        )}

        {/* Conteudo principal */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse"
                style={{
                  background: "color-mix(in srgb, var(--gold) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
                }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center gap-3 py-12 text-center"
            style={{
              background: "color-mix(in srgb, var(--bg-card) 60%, transparent)",
              border: "1px solid color-mix(in srgb, #d96a52 25%, transparent)",
            }}
          >
            <p
              className="text-[13px] italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, #d96a52 80%, transparent)",
              }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="cursor-pointer px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] transition-colors"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--gold)",
                background: "color-mix(in srgb, var(--gold) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : userCards.length === 0 ? (
          <EmptyState
            title="Inventario vazio"
            message="Voce ainda nao coletou nenhum cristal. Vence batalhas PvE pra comecar sua colecao."
          />
        ) : filteredAndSorted.length === 0 ? (
          <EmptyState
            title="Nenhum cristal encontrado"
            message="Nenhuma carta encontrada com esses filtros. Tente alterar os criterios."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredAndSorted.map((u) => (
              <InventoryCard
                key={u.id}
                userCard={u}
                onClick={(c) => setSelectedCard(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalhes */}
      <InventoryCardModal
        open={selectedCard !== null}
        userCard={selectedCard}
        onClose={() => setSelectedCard(null)}
        onChangeSpectralSkill={(userCardId) =>
          setSpectralModalUserCardId(userCardId)
        }
      />

      {/* Modal de skill espectral (5o slot em batalha) */}
      <SpectralSkillSelectModal
        open={spectralModalUserCardId !== null}
        userCardId={spectralModalUserCardId}
        currentSkillId={
          userCards.find((u) => u.id === spectralModalUserCardId)
            ?.spectralSkillId ?? null
        }
        onClose={() => setSpectralModalUserCardId(null)}
        onSaved={async () => {
          await refetchCards();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2 py-16 text-center"
      style={{
        background: "color-mix(in srgb, var(--bg-card) 50%, transparent)",
        border: "1px dashed color-mix(in srgb, var(--gold) 22%, transparent)",
      }}
    >
      <span
        className="text-[14px] uppercase tracking-[0.3em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 80%, transparent)",
        }}
      >
        {title}
      </span>
      <p
        className="max-w-md text-[13px] italic"
        style={{
          fontFamily: "var(--font-garamond)",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
        }}
      >
        {message}
      </p>
    </div>
  );
}
