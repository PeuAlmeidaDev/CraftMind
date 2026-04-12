"use client";

type BattleIdleProps = {
  onStart: () => void;
  loading: boolean;
};

export default function BattleIdle({ onStart, loading }: BattleIdleProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
        <div className="text-6xl mb-4" aria-hidden="true">
          {"\u2694\uFE0F"}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Batalha PvE</h1>

        <p className="text-sm text-gray-400 mb-8">
          Enfrente monstros e ganhe experiencia para evoluir
        </p>

        <button
          type="button"
          onClick={onStart}
          disabled={loading}
          className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Procurando oponente...
            </span>
          ) : (
            "Iniciar Batalha"
          )}
        </button>
      </div>
    </div>
  );
}
