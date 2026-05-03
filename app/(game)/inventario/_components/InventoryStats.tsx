"use client";

import type { UserCardSummary } from "@/types/cards";

type Props = {
  userCards: UserCardSummary[];
  totalCardsInGame: number | null;
};

type StatCard = {
  label: string;
  value: string;
  hint?: string;
  color: "ember" | "gold";
};

/**
 * InventoryStats — 4 cards no topo do inventario com numeros agregados.
 *
 * Quando `totalCardsInGame` e null (loading do count) mostramos "?" no
 * denominador para nao bloquear o render do resto.
 */
export default function InventoryStats({ userCards, totalCardsInGame }: Props) {
  // Cartas unicas: count distinto de card.id (1 UserCard por Card por user pela
  // unique constraint, entao userCards.length ja serve, mas defensivamente
  // contamos ids unicos caso o backend mude).
  const uniqueCardIds = new Set(userCards.map((u) => u.card.id));
  const uniqueCount = uniqueCardIds.size;

  const spectralCount = userCards.filter((u) => u.purity === 100).length;
  const maxLevelCount = userCards.filter((u) => u.level === 5).length;

  const purityAvg =
    userCards.length === 0
      ? 0
      : Math.round(
          userCards.reduce((acc, u) => acc + u.purity, 0) / userCards.length,
        );

  const stats: StatCard[] = [
    {
      label: "Cartas unicas",
      value:
        totalCardsInGame === null
          ? `${uniqueCount} / ?`
          : `${uniqueCount} / ${totalCardsInGame}`,
      hint:
        totalCardsInGame !== null && totalCardsInGame > 0
          ? `${Math.round((uniqueCount / totalCardsInGame) * 100)}% colecionado`
          : undefined,
      color: "gold",
    },
    {
      label: "Espectrais",
      value: String(spectralCount),
      hint: spectralCount === 1 ? "cristal puro" : "cristais puros",
      color: "ember",
    },
    {
      label: "Cartas Lv 5",
      value: String(maxLevelCount),
      hint: maxLevelCount === 1 ? "no level maximo" : "no level maximo",
      color: "ember",
    },
    {
      label: "Pureza media",
      value: userCards.length === 0 ? "—" : `${purityAvg}%`,
      hint: userCards.length === 0 ? "sem dados" : "media do inventario",
      color: "gold",
    },
  ];

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-label="Estatisticas do inventario"
    >
      {stats.map((s) => (
        <StatPanel key={s.label} stat={s} />
      ))}
    </section>
  );
}

function StatPanel({ stat }: { stat: StatCard }) {
  const numberColor = stat.color === "ember" ? "var(--ember)" : "var(--gold)";
  return (
    <div
      className="relative flex flex-col items-center gap-1.5 px-3 py-4 text-center"
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
          className="pointer-events-none absolute h-2 w-2"
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

      <span
        className="text-[26px] font-medium leading-none sm:text-[32px]"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: numberColor,
        }}
      >
        {stat.value}
      </span>
      <span
        className="text-[9px] uppercase tracking-[0.3em]"
        style={{
          fontFamily: "var(--font-cinzel)",
          color: "color-mix(in srgb, var(--gold) 80%, transparent)",
        }}
      >
        {stat.label}
      </span>
      {stat.hint && (
        <span
          className="text-[10px] italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 55%, transparent)",
          }}
        >
          {stat.hint}
        </span>
      )}
    </div>
  );
}
