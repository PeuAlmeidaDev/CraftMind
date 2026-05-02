"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  clearAuthAndRedirect,
  authFetchOptions,
} from "@/lib/client-auth";
import type {
  HouseFilter,
  HouseStandardEntry,
  RankingHabitsEntry,
  RankingLevelEntry,
  RankingPvpEntry,
  RankingSeason,
} from "@/types/ranking";
import RankingTabs, {
  type RankingCategory,
} from "./_components/RankingTabs";
import HouseFilterTabs from "./_components/HouseFilter";
import SeasonToggle from "./_components/SeasonToggle";
import RankingTable from "./_components/RankingTable";
import EstandarteCasas from "./_components/EstandarteCasas";

// ---------------------------------------------------------------------------
// Tipo do payload da pagina (uniao discriminada por categoria)
// ---------------------------------------------------------------------------

type PvpResponse = { entries: RankingPvpEntry[] };
type LevelResponse = { entries: RankingLevelEntry[] };
type HabitsResponse = { entries: RankingHabitsEntry[] };
type HousesResponse = { entries: HouseStandardEntry[] };

type RankingState =
  | { category: "pvp-1v1"; entries: RankingPvpEntry[] }
  | { category: "pvp-team"; entries: RankingPvpEntry[] }
  | { category: "level"; entries: RankingLevelEntry[] }
  | { category: "habits"; entries: RankingHabitsEntry[] }
  | { category: "houses"; entries: HouseStandardEntry[] };

const DEFAULT_LIMIT = 50;

function buildEndpoint(
  category: RankingCategory,
  house: HouseFilter,
  season: RankingSeason,
): string {
  if (category === "houses") {
    return `/api/ranking/houses?season=${season}`;
  }
  return `/api/ranking/${category}?house=${house}&limit=${DEFAULT_LIMIT}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RankingPage() {
  const router = useRouter();
  const [category, setCategory] = useState<RankingCategory>("pvp-1v1");
  const [house, setHouse] = useState<HouseFilter>("GLOBAL");
  const [season, setSeason] = useState<RankingSeason>("lifetime");
  const [state, setState] = useState<RankingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      try {
        const url = buildEndpoint(category, house, season);
        const res = await fetch(url, authFetchOptions(token!, ac.signal));

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          setError("Falha ao carregar ranking.");
          setState(null);
          return;
        }

        // Type-narrow pela categoria atual
        if (category === "pvp-1v1") {
          const json = (await res.json()) as { data: PvpResponse };
          setState({ category, entries: json.data.entries });
        } else if (category === "pvp-team") {
          const json = (await res.json()) as { data: PvpResponse };
          setState({ category, entries: json.data.entries });
        } else if (category === "level") {
          const json = (await res.json()) as { data: LevelResponse };
          setState({ category, entries: json.data.entries });
        } else if (category === "habits") {
          const json = (await res.json()) as { data: HabitsResponse };
          setState({ category, entries: json.data.entries });
        } else {
          const json = (await res.json()) as { data: HousesResponse };
          setState({ category, entries: json.data.entries });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Erro de rede.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchData();
    return () => ac.abort();
  }, [category, house, season, router]);

  const showHouseFilter = category !== "houses";
  const showSeasonToggle = category === "houses";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.4em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          }}
        >
          Salao dos Pendoes
        </span>
        <h1
          className="text-[32px] italic text-white"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Ranking
        </h1>
      </header>

      {/* Tabs principais */}
      <RankingTabs active={category} onChange={setCategory} />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {showHouseFilter && (
          <HouseFilterTabs active={house} onChange={setHouse} />
        )}
        {showSeasonToggle && (
          <SeasonToggle active={season} onChange={setSeason} />
        )}
      </div>

      {/* Conteudo */}
      <section className="min-h-[200px]">
        {loading && <RankingSkeleton />}
        {!loading && error && <RankingError message={error} />}
        {!loading && !error && state && (
          <RenderState state={state} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes auxiliares
// ---------------------------------------------------------------------------

function RankingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse"
          style={{
            background: "color-mix(in srgb, var(--gold) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

function RankingError({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-12 text-center"
      style={{
        fontFamily: "var(--font-cormorant)",
        color: "color-mix(in srgb, #d96a52 80%, transparent)",
        border: "1px solid color-mix(in srgb, #d96a52 30%, transparent)",
        background: "color-mix(in srgb, #d96a52 6%, transparent)",
        fontSize: 16,
        fontStyle: "italic",
      }}
    >
      {message}
    </div>
  );
}

function RenderState({ state }: { state: RankingState }) {
  switch (state.category) {
    case "pvp-1v1":
      return <RankingTable type="pvp-1v1" entries={state.entries} />;
    case "pvp-team":
      return <RankingTable type="pvp-team" entries={state.entries} />;
    case "level":
      return <RankingTable type="level" entries={state.entries} />;
    case "habits":
      return <RankingTable type="habits" entries={state.entries} />;
    case "houses":
      return <EstandarteCasas entries={state.entries} />;
  }
}
