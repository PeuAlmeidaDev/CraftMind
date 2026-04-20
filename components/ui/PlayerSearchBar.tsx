"use client";

import { useState, useRef } from "react";
import { getToken } from "@/lib/client-auth";

export type PlayerPublicProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  house: { name: string; animal: string } | null;
  character: {
    level: number;
    physicalAtk: number;
    physicalDef: number;
    magicAtk: number;
    magicDef: number;
    hp: number;
    speed: number;
  };
  pvpStats: {
    totalBattles: number;
    wins: number;
    losses: number;
    draws: number;
  };
};

type PlayerSearchBarProps = {
  onPlayerFound: (player: PlayerPublicProfile) => void;
};

export default function PlayerSearchBar({
  onPlayerFound,
}: PlayerSearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/user/by-name/${encodeURIComponent(trimmed)}/profile`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        },
      );

      if (res.status === 404) {
        setError("Jogador nao encontrado");
        return;
      }

      if (!res.ok) {
        setError("Erro ao buscar jogador");
        return;
      }

      const json = (await res.json()) as { data: PlayerPublicProfile };
      onPlayerFound(json.data);
      setQuery("");
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar jogador..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          disabled={loading}
          className="transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-[#4a4a5a] w-full"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: `1px solid ${error ? "#ef4444" : "var(--border-subtle)"}`,
            borderRadius: "8px",
            padding: "8px 12px",
            color: "#ffffff",
            fontSize: "0.813rem",
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--accent-primary)";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(124,58,237,0.15)";
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "#ef4444"
              : "var(--border-subtle)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex shrink-0 items-center justify-center cursor-pointer rounded-lg text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
            border: "none",
            borderRadius: "8px",
            padding: "8px",
            width: "36px",
            height: "36px",
          }}
          onMouseEnter={(e) => {
            if (!loading && query.trim()) {
              e.currentTarget.style.filter = "brightness(1.15)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 15px rgba(124,58,237,0.3)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "";
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "";
          }}
        >
          {loading ? (
            <div
              className="animate-spin rounded-full"
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#ffffff",
              }}
            />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </form>
  );
}
