"use client";

import { useState } from "react";
import type {
  BestiaryEntry,
  BestiaryCardInfo,
  BestiaryTotals,
} from "@/types/cards";
import BestiaryCard from "./BestiaryCard";
import BestiaryDetailModal from "./BestiaryDetailModal";

type Props = {
  entries: BestiaryEntry[];
  totals: BestiaryTotals;
};

type Selection = {
  mobId: string;
  /** Se null, modal abre sem variante focada (mostra info geral do mob). */
  cardId: string | null;
};

export default function BestiaryGrid({ entries, totals }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const selectedEntry: BestiaryEntry | null = selection
    ? entries.find((e) => e.mobId === selection.mobId) ?? null
    : null;
  const selectedCard: BestiaryCardInfo | null =
    selectedEntry && selection?.cardId
      ? selectedEntry.cards.find((c) => c.id === selection.cardId) ?? null
      : null;

  return (
    <section className="flex flex-col gap-5">
      {/* Header com totals */}
      <header
        className="relative border p-4"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
        }}
      >
        {/* Corner ticks */}
        {[
          { top: -1, left: -1 },
          { top: -1, right: -1 },
          { bottom: -1, left: -1 },
          { bottom: -1, right: -1 },
        ].map((pos, i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-2.5 w-2.5"
            style={{
              ...pos,
              borderTop:
                pos.top !== undefined
                  ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "none",
              borderBottom:
                pos.bottom !== undefined
                  ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "none",
              borderLeft:
                pos.left !== undefined
                  ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "none",
              borderRight:
                pos.right !== undefined
                  ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "none",
            }}
          />
        ))}

        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.4em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Compendio das Criaturas
          </span>
          <h1
            className="text-[32px] font-medium leading-tight text-white"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Bestiario
          </h1>
          <p
            className="text-[12px] italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 67%, transparent)",
            }}
          >
            Cada vitoria revela um pouco mais sobre as criaturas que voce enfrenta.
          </p>

          {/* Linha de totais */}
          <div
            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            <span>
              Descobertos&nbsp;
              <span className="text-white">{totals.discovered}</span>
              <span style={{ color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}>
                /{totals.total}
              </span>
            </span>
            <span style={{ color: "color-mix(in srgb, var(--gold) 30%, transparent)" }}>&middot;</span>
            <span>
              Estudados&nbsp;
              <span className="text-white">{totals.studied}</span>
              <span style={{ color: "color-mix(in srgb, var(--gold) 50%, transparent)" }}>
                /{totals.total}
              </span>
            </span>
            <span style={{ color: "color-mix(in srgb, var(--gold) 30%, transparent)" }}>&middot;</span>
            <span style={{ color: "#f4c45a" }}>
              Mestres&nbsp;
              <span className="text-white">{totals.mastered}</span>
              <span style={{ color: "color-mix(in srgb, #f4c45a 60%, transparent)" }}>
                /{totals.total}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Grid responsivo — cards portrait full-art */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map((entry) => (
          <BestiaryCard
            key={entry.mobId}
            entry={entry}
            onSelect={(card) =>
              setSelection({
                mobId: entry.mobId,
                cardId: card?.id ?? null,
              })
            }
          />
        ))}
      </div>

      {/* Modal de detalhe */}
      <BestiaryDetailModal
        entry={selectedEntry}
        selectedCard={selectedCard}
        open={selectedEntry !== null}
        onClose={() => setSelection(null)}
      />
    </section>
  );
}
