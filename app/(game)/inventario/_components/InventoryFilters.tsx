"use client";

import { CardRarity } from "@/types/cards";

// ---------------------------------------------------------------------------
// Tipos publicos consumidos pela page
// ---------------------------------------------------------------------------

export type EquippedFilter = "ALL" | "EQUIPPED" | "UNEQUIPPED";

export type PurityFilter =
  | "ANY"
  | "SPECTRAL"
  | "EXCELLENT"
  | "GREAT"
  | "GOOD"
  | "AVERAGE"
  | "TRASH";

export type SortOption =
  | "PURITY_DESC"
  | "LEVEL_DESC"
  | "RARITY_DESC"
  | "NAME_ASC"
  | "RECENT_DESC";

export const PURITY_OPTIONS: { value: PurityFilter; label: string }[] = [
  { value: "ANY", label: "Qualquer" },
  { value: "SPECTRAL", label: "Espectral (100%)" },
  { value: "EXCELLENT", label: "Excelente (95-99)" },
  { value: "GREAT", label: "Otima (90-94)" },
  { value: "GOOD", label: "Boa (70-89)" },
  { value: "AVERAGE", label: "Media (40-69)" },
  { value: "TRASH", label: "Lixo (0-39)" },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "PURITY_DESC", label: "Pureza (maior primeiro)" },
  { value: "LEVEL_DESC", label: "Level (maior primeiro)" },
  { value: "RARITY_DESC", label: "Raridade (maior primeiro)" },
  { value: "NAME_ASC", label: "Nome (A-Z)" },
  { value: "RECENT_DESC", label: "Mais recente" },
];

const RARITY_ORDER: CardRarity[] = [
  CardRarity.COMUM,
  CardRarity.INCOMUM,
  CardRarity.RARO,
  CardRarity.EPICO,
  CardRarity.LENDARIO,
];

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

const EQUIPPED_OPTIONS: { value: EquippedFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "EQUIPPED", label: "So equipadas" },
  { value: "UNEQUIPPED", label: "So nao equipadas" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  rarities: Set<CardRarity>;
  purity: PurityFilter;
  equipped: EquippedFilter;
  search: string;
  sort: SortOption;
  onToggleRarity: (r: CardRarity) => void;
  onToggleAllRarities: () => void;
  onPurityChange: (p: PurityFilter) => void;
  onEquippedChange: (e: EquippedFilter) => void;
  onSearchChange: (s: string) => void;
  onSortChange: (s: SortOption) => void;
  onResetFilters: () => void;
};

export default function InventoryFilters({
  rarities,
  purity,
  equipped,
  search,
  sort,
  onToggleRarity,
  onToggleAllRarities,
  onPurityChange,
  onEquippedChange,
  onSearchChange,
  onSortChange,
  onResetFilters,
}: Props) {
  const allActive = rarities.size === RARITY_ORDER.length;

  return (
    <section
      className="relative flex flex-col gap-3 border p-4"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
      }}
      aria-label="Filtros do inventario"
    >
      {/* Linha 1: busca + ordenacao */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <label
            htmlFor="inv-search"
            className="text-[9px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Buscar
          </label>
          <input
            id="inv-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nome do cristal ou mob"
            className="flex-1 px-3 py-2 text-[12px] outline-none transition-colors"
            style={{
              fontFamily: "var(--font-mono)",
              background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
              border: "1px solid color-mix(in srgb, var(--gold) 22%, transparent)",
              color: "white",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="inv-sort"
            className="text-[9px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Ordenar
          </label>
          <select
            id="inv-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="cursor-pointer px-2 py-2 text-[11px] outline-none"
            style={{
              fontFamily: "var(--font-mono)",
              background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
              border: "1px solid color-mix(in srgb, var(--gold) 22%, transparent)",
              color: "white",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 2: raridade */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[9px] uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Raridade
        </span>
        <div className="flex flex-wrap gap-1">
          {RARITY_ORDER.map((r) => {
            const active = rarities.has(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => onToggleRarity(r)}
                className={`cursor-pointer px-2 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors ${RARITY_CLASS[r]}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  color: active
                    ? "var(--rarity-color)"
                    : "color-mix(in srgb, var(--gold) 50%, transparent)",
                  background: active
                    ? "color-mix(in srgb, var(--rarity-color) 12%, transparent)"
                    : "transparent",
                  border: `1px solid ${active ? "var(--rarity-color)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                }}
              >
                {RARITY_LABEL[r]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onToggleAllRarities}
            className="cursor-pointer px-2 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 70%, transparent)",
              background: "transparent",
              border: "1px dashed color-mix(in srgb, var(--gold) 30%, transparent)",
            }}
            aria-label={allActive ? "Desmarcar todas raridades" : "Marcar todas raridades"}
          >
            {allActive ? "Limpar" : "Todas"}
          </button>
        </div>
      </div>

      {/* Linha 3: pureza + equipada + reset */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="inv-purity"
            className="text-[9px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Pureza
          </label>
          <select
            id="inv-purity"
            value={purity}
            onChange={(e) => onPurityChange(e.target.value as PurityFilter)}
            className="cursor-pointer px-2 py-1.5 text-[11px] outline-none"
            style={{
              fontFamily: "var(--font-mono)",
              background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
              border: "1px solid color-mix(in srgb, var(--gold) 22%, transparent)",
              color: "white",
            }}
          >
            {PURITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[9px] uppercase tracking-[0.3em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Equipada
          </span>
          <div className="flex">
            {EQUIPPED_OPTIONS.map((opt, i) => {
              const active = equipped === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onEquippedChange(opt.value)}
                  className="cursor-pointer px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: active
                      ? "var(--ember)"
                      : "color-mix(in srgb, var(--gold) 60%, transparent)",
                    background: active
                      ? "color-mix(in srgb, var(--ember) 12%, transparent)"
                      : "transparent",
                    border: `1px solid ${active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 22%, transparent)"}`,
                    borderLeftWidth: i === 0 ? "1px" : "0",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onResetFilters}
          className="cursor-pointer px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] transition-colors sm:ml-auto"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "color-mix(in srgb, var(--gold) 70%, transparent)",
            background: "transparent",
            border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)",
          }}
        >
          Resetar filtros
        </button>
      </div>
    </section>
  );
}
