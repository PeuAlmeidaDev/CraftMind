"use client";

type CoopPveResultProps = {
  result: "VICTORY" | "DEFEAT";
  expGained: number;
  levelsGained: number;
  newLevel: number;
  onPlayAgain: () => void;
  onGoHome: () => void;
};

export default function CoopPveResult({
  result,
  expGained,
  levelsGained,
  newLevel,
  onPlayAgain,
  onGoHome,
}: CoopPveResultProps) {
  const isVictory = result === "VICTORY";

  return (
    <>
      <style>{`
        @keyframes coopResultFadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .coop-result-enter {
          animation: coopResultFadeIn 0.4s ease-out forwards;
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="coop-result-enter max-w-sm w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="text-5xl mb-4">
            {isVictory ? "\uD83C\uDFC6" : "\uD83D\uDC80"}
          </div>

          {/* Title */}
          <h2
            className={`text-2xl font-bold mb-4 ${
              isVictory ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isVictory ? "Vitoria!" : "Derrota"}
          </h2>

          {/* Stats */}
          <div className="space-y-2 text-sm text-gray-400 mb-6">
            <p>
              EXP ganho:{" "}
              <span className="text-white font-semibold">+{expGained}</span>
            </p>
            {levelsGained > 0 && (
              <p className="text-yellow-400 font-semibold">
                Level up! Novo nivel: {newLevel}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onPlayAgain}
              className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 hover:brightness-110 transition cursor-pointer"
            >
              Jogar novamente
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="w-full rounded-lg py-2 text-sm text-gray-400 hover:text-white transition cursor-pointer"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
