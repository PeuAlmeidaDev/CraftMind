"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useToast } from "../_components/toast";

type CardRow = {
  id: string;
  mobId: string;
  name: string;
  flavorText: string;
  rarity: string;
  cardArtUrl: string | null;
  effects: unknown;
  requiredStars: number;
  dropChance: number;
  mob: {
    id: string;
    name: string;
    tier: number;
    imageUrl: string | null;
  };
};

function formatDropChance(value: number): string {
  // Mostra inteiro quando possivel (5%), 1 casa decimal caso contrario (7.5%)
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? `${rounded.toFixed(0)}%`
    : `${rounded.toFixed(1)}%`;
}

function starsLabel(stars: number): string {
  const safe = Math.max(1, Math.min(3, Math.round(stars)));
  return "★".repeat(safe);
}

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-500/20 text-gray-400",
  2: "bg-green-500/20 text-green-400",
  3: "bg-blue-500/20 text-blue-400",
  4: "bg-purple-500/20 text-purple-400",
  5: "bg-amber-500/20 text-amber-400",
};

const RARITY_COLORS: Record<string, string> = {
  COMUM: "text-gray-300 border-gray-500/40",
  INCOMUM: "text-green-300 border-green-500/40",
  RARO: "text-blue-300 border-blue-500/40",
  EPICO: "text-purple-300 border-purple-500/40",
  LENDARIO: "text-amber-300 border-amber-500/40",
};

const RARITY_LABEL: Record<string, string> = {
  COMUM: "Comum",
  INCOMUM: "Incomum",
  RARO: "Raro",
  EPICO: "Epico",
  LENDARIO: "Lendario",
};

export default function AdminCardsPage() {
  const { showToast } = useToast();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRarity, setFilterRarity] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterStars, setFilterStars] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/cards")
      .then((r) => r.json())
      .then((res) => setCards(res.data ?? []))
      .catch(() => showToast("Erro ao carregar cards", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filterRarity && c.rarity !== filterRarity) return false;
      if (filterTier && c.mob.tier !== Number(filterTier)) return false;
      if (filterStars && c.requiredStars !== Number(filterStars)) return false;
      return true;
    });
  }, [cards, filterRarity, filterTier, filterStars]);

  async function handleImageUpload(cardId: string, file: File) {
    setUploadingId(cardId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/admin/cards/${cardId}/image`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao fazer upload", "error");
        return;
      }

      const newUrl = json.data.cardArtUrl;
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, cardArtUrl: newUrl } : c)),
      );
      showToast("Arte atualizada", "success");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setUploadingId(null);
    }
  }

  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  async function handleImageDelete(cardId: string) {
    setDeletingImageId(cardId);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/image`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Erro ao remover arte", "error");
        return;
      }
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, cardArtUrl: null } : c)),
      );
      showToast("Arte removida", "success");
    } catch {
      showToast("Erro de conexao", "error");
    } finally {
      setDeletingImageId(null);
    }
  }

  const selectClass =
    "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Cristais</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {cards.length} cristais · ate 3 variantes por mob (1★/2★/3★)
          </p>
        </div>
        <Link
          href="/admin/cards/new"
          className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] hover:brightness-110 rounded-lg transition"
        >
          Novo Cristal
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className={selectClass}
        >
          <option value="">Tier: Todos</option>
          {[1, 2, 3, 4, 5].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </select>
        <select
          value={filterRarity}
          onChange={(e) => setFilterRarity(e.target.value)}
          className={selectClass}
        >
          <option value="">Raridade: Todas</option>
          <option value="COMUM">Comum</option>
          <option value="INCOMUM">Incomum</option>
          <option value="RARO">Raro</option>
          <option value="EPICO">Epico</option>
          <option value="LENDARIO">Lendario</option>
        </select>
        <select
          value={filterStars}
          onChange={(e) => setFilterStars(e.target.value)}
          className={selectClass}
          aria-label="Filtrar por estrela minima"
        >
          <option value="">Estrela: Todas</option>
          <option value="1">1★</option>
          <option value="2">2★</option>
          <option value="3">3★</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          Nenhum cristal encontrado
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((card) => {
            const effectsCount = Array.isArray(card.effects)
              ? card.effects.length
              : 0;
            return (
              <div
                key={card.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  {card.cardArtUrl || card.mob.imageUrl ? (
                    <img
                      src={card.cardArtUrl ?? card.mob.imageUrl ?? ""}
                      alt={card.name}
                      className="w-16 h-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                      <span className="text-xl text-gray-500">
                        {card.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">
                      {card.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      Mob: {card.mob.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${TIER_COLORS[card.mob.tier] ?? TIER_COLORS[1]}`}
                      >
                        T{card.mob.tier}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border ${RARITY_COLORS[card.rarity] ?? ""}`}
                      >
                        {RARITY_LABEL[card.rarity] ?? card.rarity}
                      </span>
                      <span
                        className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-300 tracking-wider"
                        aria-label={`Estrela minima: ${card.requiredStars}`}
                        title={`Estrela minima: ${card.requiredStars}`}
                      >
                        {starsLabel(card.requiredStars)}
                      </span>
                      <span
                        className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-300"
                        aria-label={`Chance de drop: ${formatDropChance(card.dropChance)}`}
                        title={`Chance de drop: ${formatDropChance(card.dropChance)}`}
                      >
                        {formatDropChance(card.dropChance)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 italic mb-3 line-clamp-2">
                  &laquo; {card.flavorText} &raquo;
                </p>

                <p className="text-xs text-gray-500 mb-3">
                  {effectsCount} efeito{effectsCount === 1 ? "" : "s"}
                  {card.cardArtUrl ? " · arte custom" : " · arte: foto do mob"}
                </p>

                <div className="flex gap-2">
                  <Link
                    href={`/admin/cards/${card.id}`}
                    className="flex-1 text-center text-xs py-1.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingId(card.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingId === card.id}
                    className="flex-1 text-xs py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {uploadingId === card.id ? "Enviando..." : "Foto"}
                  </button>
                  {card.cardArtUrl && (
                    <button
                      type="button"
                      onClick={() => handleImageDelete(card.id)}
                      disabled={deletingImageId === card.id}
                      className="flex-1 text-xs py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer disabled:opacity-50"
                    >
                      {deletingImageId === card.id ? "..." : "Tirar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && pendingId) {
            handleImageUpload(pendingId, file);
          }
          e.target.value = "";
          setPendingId(null);
        }}
      />
    </div>
  );
}
