"use client";

import type { ReactNode } from "react";
import type {
  RankingPvpEntry,
  RankingLevelEntry,
  RankingHabitsEntry,
} from "@/types/ranking";
import type { HouseName } from "@/types/house";
import { HOUSE_BADGE_COLORS, HOUSE_DISPLAY } from "./house-colors";

// ---------------------------------------------------------------------------
// Discriminated union de props (evita any ao renderizar colunas distintas)
// ---------------------------------------------------------------------------

type RankingTableProps =
  | { type: "pvp-1v1"; entries: RankingPvpEntry[] }
  | { type: "pvp-team"; entries: RankingPvpEntry[] }
  | { type: "level"; entries: RankingLevelEntry[] }
  | { type: "habits"; entries: RankingHabitsEntry[] };

// ---------------------------------------------------------------------------
// Estilos do destaque do top 3
// ---------------------------------------------------------------------------

const TOP_BORDER: Record<1 | 2 | 3, string> = {
  1: "color-mix(in srgb, #f5d27a 70%, transparent)", // ouro
  2: "color-mix(in srgb, #cfd6dc 60%, transparent)", // prata
  3: "color-mix(in srgb, #d4894a 60%, transparent)", // bronze
};

const TOP_BG: Record<1 | 2 | 3, string> = {
  1: "linear-gradient(180deg, color-mix(in srgb, #f5d27a 14%, transparent), color-mix(in srgb, #f5d27a 4%, transparent))",
  2: "linear-gradient(180deg, color-mix(in srgb, #cfd6dc 12%, transparent), color-mix(in srgb, #cfd6dc 3%, transparent))",
  3: "linear-gradient(180deg, color-mix(in srgb, #d4894a 12%, transparent), color-mix(in srgb, #d4894a 3%, transparent))",
};

function getRowStyle(rank: number): React.CSSProperties {
  if (rank === 1 || rank === 2 || rank === 3) {
    return {
      background: TOP_BG[rank],
      border: `1px solid ${TOP_BORDER[rank]}`,
    };
  }
  return {
    background: "var(--bg-card)",
    border: "1px solid var(--border-subtle)",
  };
}

// ---------------------------------------------------------------------------
// Avatar com fallback
// ---------------------------------------------------------------------------

function Avatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}): ReactNode {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-9 w-9 shrink-0 object-cover"
        style={{
          border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
          background: "var(--bg-secondary)",
        }}
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center text-[14px]"
      style={{
        fontFamily: "var(--font-cormorant)",
        color: "var(--gold)",
        background: "color-mix(in srgb, var(--gold) 8%, var(--bg-secondary))",
        border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
      }}
    >
      {initial}
    </div>
  );
}

// ---------------------------------------------------------------------------
// House badge inline
// ---------------------------------------------------------------------------

function HouseBadge({ house }: { house: HouseName | null }): ReactNode {
  if (!house) {
    return (
      <span
        className="text-[8px] uppercase tracking-[0.2em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 35%, transparent)",
        }}
      >
        —
      </span>
    );
  }
  const color = HOUSE_BADGE_COLORS[house];
  return (
    <span
      className="px-2 py-0.5 text-[8px] uppercase tracking-[0.25em]"
      style={{
        fontFamily: "var(--font-cinzel)",
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      {HOUSE_DISPLAY[house]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Numero da posicao com destaque para top 3
// ---------------------------------------------------------------------------

function RankNumber({ rank }: { rank: number }): ReactNode {
  let color = "color-mix(in srgb, var(--gold) 55%, transparent)";
  if (rank === 1) color = "#f5d27a";
  else if (rank === 2) color = "#cfd6dc";
  else if (rank === 3) color = "#d4894a";

  return (
    <span
      className="w-8 shrink-0 text-center text-[18px] tabular-nums"
      style={{
        fontFamily: "var(--font-cormorant)",
        color,
        textShadow:
          rank <= 3
            ? `0 0 12px color-mix(in srgb, ${color} 50%, transparent)`
            : undefined,
      }}
    >
      {rank}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header / coluna de metrica
// ---------------------------------------------------------------------------

function MetricLabel({ children }: { children: ReactNode }): ReactNode {
  return (
    <span
      className="text-[8px] uppercase tracking-[0.25em]"
      style={{
        fontFamily: "var(--font-cinzel)",
        color: "color-mix(in srgb, var(--gold) 50%, transparent)",
      }}
    >
      {children}
    </span>
  );
}

function MetricValue({ children }: { children: ReactNode }): ReactNode {
  return (
    <span
      className="text-[14px] tabular-nums text-white"
      style={{ fontFamily: "var(--font-jetbrains)" }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function RankingTable(props: RankingTableProps): ReactNode {
  if (props.entries.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-center"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: "color-mix(in srgb, var(--gold) 55%, transparent)",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          fontSize: 16,
          fontStyle: "italic",
        }}
      >
        Nenhum dado disponivel ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {props.entries.map((entry) => {
        const rowStyle = getRowStyle(entry.rank);
        return (
          <div
            key={entry.userId}
            className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3"
            style={rowStyle}
          >
            <RankNumber rank={entry.rank} />
            <Avatar url={entry.avatarUrl} name={entry.name} />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className="truncate text-[16px] text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                {entry.name}
              </span>
              <div className="flex items-center gap-2">
                <HouseBadge house={entry.house} />
                <span
                  className="text-[9px] uppercase tracking-[0.2em]"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "color-mix(in srgb, var(--gold) 55%, transparent)",
                  }}
                >
                  Lvl {entry.level}
                </span>
              </div>
            </div>

            {/* Coluna de metrica especifica do tipo */}
            <div className="flex shrink-0 flex-col items-end gap-0.5 sm:gap-1">
              {(() => {
                switch (props.type) {
                  case "pvp-1v1":
                  case "pvp-team": {
                    // entry tem rankingPoints/wins/losses/draws
                    const e = entry as RankingPvpEntry;
                    return (
                      <>
                        <MetricLabel>Pontos</MetricLabel>
                        <MetricValue>{e.rankingPoints}</MetricValue>
                        <span
                          className="text-[9px] tabular-nums"
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            color:
                              "color-mix(in srgb, var(--gold) 50%, transparent)",
                          }}
                        >
                          {e.wins}V {e.losses}D {e.draws}E
                        </span>
                      </>
                    );
                  }
                  case "level": {
                    const e = entry as RankingLevelEntry;
                    return (
                      <>
                        <MetricLabel>Nivel</MetricLabel>
                        <MetricValue>{e.level}</MetricValue>
                        <span
                          className="text-[9px] tabular-nums"
                          style={{
                            fontFamily: "var(--font-jetbrains)",
                            color:
                              "color-mix(in srgb, var(--gold) 50%, transparent)",
                          }}
                        >
                          {e.currentExp} EXP
                        </span>
                      </>
                    );
                  }
                  case "habits": {
                    const e = entry as RankingHabitsEntry;
                    return (
                      <>
                        <MetricLabel>Habitos</MetricLabel>
                        <MetricValue>{e.habitCount}</MetricValue>
                      </>
                    );
                  }
                }
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
