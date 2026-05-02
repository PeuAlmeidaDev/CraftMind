"use client";

import type { ReactNode } from "react";
import type { HouseStandardEntry } from "@/types/ranking";
import {
  HOUSE_BADGE_COLORS,
  HOUSE_BANNER_PATH,
  HOUSE_DISPLAY,
} from "./house-colors";

type Props = {
  entries: HouseStandardEntry[];
};

const RANK_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "1º",
  2: "2º",
  3: "3º",
  4: "4º",
};

function formatScore(value: number): string {
  if (value === 0) return "0";
  if (value >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

export default function EstandarteCasas({ entries }: Props): ReactNode {
  if (entries.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-16 text-center"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: "color-mix(in srgb, var(--gold) 55%, transparent)",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          fontSize: 16,
          fontStyle: "italic",
        }}
      >
        Estandarte vazio neste periodo.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Disclaimer per capita */}
      <p
        className="text-[10px] uppercase tracking-[0.25em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 55%, transparent)",
        }}
      >
        Pontuacao per capita — soma dos pontos da casa dividida pelos seus membros.
      </p>

      {/* Grid de banners — 4 colunas no desktop, empilha no mobile */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {entries.map((entry) => {
          const isLeader = entry.rank === 1;
          const accent = HOUSE_BADGE_COLORS[entry.house];
          const banner = HOUSE_BANNER_PATH[entry.house];

          return (
            <article
              key={entry.house}
              className="relative overflow-hidden"
              style={{
                aspectRatio: "3 / 4",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 92%, transparent), var(--bg-primary))",
                border: isLeader
                  ? `1px solid color-mix(in srgb, #f5d27a 70%, transparent)`
                  : `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
                boxShadow: isLeader
                  ? "0 0 32px color-mix(in srgb, #f5d27a 35%, transparent), inset 0 0 24px color-mix(in srgb, #f5d27a 10%, transparent)"
                  : `inset 0 0 18px color-mix(in srgb, ${accent} 6%, transparent)`,
              }}
            >
              {/* Bandeira da casa em background fantasma */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${banner})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: 0.18,
                  filter: "saturate(1.1) contrast(1.05)",
                  mixBlendMode: "screen",
                }}
              />

              {/* Vinheta para escurecer bordas e legibilizar texto */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 30%, transparent 50%, rgba(0,0,0,0.55) 100%)",
                }}
              />

              {/* Glow / halo pulsante para o lider */}
              {isLeader && (
                <div
                  aria-hidden
                  className="absolute inset-0 animate-house-leader-pulse"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 38%, color-mix(in srgb, #f5d27a 20%, transparent) 0%, transparent 60%)",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Conteudo */}
              <div className="relative z-[2] flex h-full flex-col items-center justify-between p-4 text-center">
                {/* Topo: rank + nome da casa */}
                <header className="flex flex-col items-center gap-1">
                  <span
                    className="text-[11px] uppercase tracking-[0.4em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: isLeader
                        ? "#f5d27a"
                        : "color-mix(in srgb, var(--gold) 60%, transparent)",
                      textShadow: isLeader
                        ? "0 0 14px color-mix(in srgb, #f5d27a 60%, transparent)"
                        : undefined,
                    }}
                  >
                    {RANK_LABEL[entry.rank as 1 | 2 | 3 | 4] ?? `${entry.rank}º`}
                  </span>
                  <h3
                    className="text-[28px] tracking-[0.18em] uppercase text-white"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      textShadow: `0 0 18px color-mix(in srgb, ${accent} 50%, transparent)`,
                    }}
                  >
                    {HOUSE_DISPLAY[entry.house]}
                  </h3>
                  <span
                    className="text-[12px] italic"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                    }}
                  >
                    {entry.animal}
                  </span>
                </header>

                {/* Centro: pontuacao */}
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-[9px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 55%, transparent)",
                    }}
                  >
                    Pontuacao
                  </span>
                  <span
                    className="text-[42px] tabular-nums leading-none"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      color: isLeader ? "#f5d27a" : "white",
                      textShadow: isLeader
                        ? "0 0 24px color-mix(in srgb, #f5d27a 70%, transparent)"
                        : `0 0 14px color-mix(in srgb, ${accent} 35%, transparent)`,
                    }}
                  >
                    {formatScore(entry.score)}
                  </span>
                </div>

                {/* Rodape: stats secundarios */}
                <footer className="flex w-full items-center justify-between gap-2">
                  <div className="flex flex-col items-start gap-0.5">
                    <span
                      className="text-[8px] uppercase tracking-[0.25em]"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                      }}
                    >
                      Eventos
                    </span>
                    <span
                      className="text-[14px] tabular-nums text-white"
                      style={{ fontFamily: "var(--font-jetbrains)" }}
                    >
                      {entry.totalEvents}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="text-[8px] uppercase tracking-[0.25em]"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                      }}
                    >
                      Membros
                    </span>
                    <span
                      className="text-[14px] tabular-nums text-white"
                      style={{ fontFamily: "var(--font-jetbrains)" }}
                    >
                      {entry.membersCount}
                    </span>
                  </div>
                </footer>
              </div>
            </article>
          );
        })}
      </div>

      {/* Keyframes do halo do lider — escopo local */}
      <style jsx>{`
        @keyframes houseLeaderPulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
        :global(.animate-house-leader-pulse) {
          animation: houseLeaderPulse 3.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
