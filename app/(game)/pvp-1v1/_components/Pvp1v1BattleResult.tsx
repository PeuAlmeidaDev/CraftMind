"use client";

import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Pvp1v1BattleResultProps = {
  result: "VICTORY" | "DEFEAT" | "DRAW";
};

// ---------------------------------------------------------------------------
// Ranking config (1v1 specific: +30 / -20 / +5)
// ---------------------------------------------------------------------------

const RANKING_POINTS: Record<Pvp1v1BattleResultProps["result"], { text: string; value: string; valueColor: string }> = {
  VICTORY: { text: "Recompensa", value: "+30 Ranking Points", valueColor: "var(--ember)" },
  DEFEAT: { text: "Penalidade", value: "-20 Ranking Points", valueColor: "#d96a52" },
  DRAW: { text: "Empate", value: "+5 Ranking Points", valueColor: "var(--gold)" },
};

// ---------------------------------------------------------------------------
// Component (identical design to CoopPveResult / PvpTeamBattleResult)
// ---------------------------------------------------------------------------

export default function Pvp1v1BattleResult({
  result,
}: Pvp1v1BattleResultProps) {
  const router = useRouter();
  const isVictory = result === "VICTORY";
  const isDraw = result === "DRAW";
  const ranking = RANKING_POINTS[result];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-6"
      style={{
        background: "rgba(5, 3, 10, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "matchPop 380ms cubic-bezier(.2,1.2,.3,1)",
      }}
    >
      <div
        className="mx-auto w-full max-w-md p-8 text-center md:my-auto"
        style={{
          background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, var(--ember) 40%, transparent)",
          boxShadow: "0 30px 80px var(--bg-primary), 0 0 40px color-mix(in srgb, var(--ember) 14%, transparent)",
        }}
      >
        <h2
          className="mt-2 text-[38px] font-medium"
          style={{
            fontFamily: "var(--font-cormorant)",
            color: isVictory ? "var(--ember)" : "#d96a52",
            textShadow: isVictory
              ? "0 0 12px color-mix(in srgb, var(--ember) 33%, transparent)"
              : "none",
          }}
        >
          {isVictory ? "Vitoria!" : isDraw ? "Empate" : "Derrota"}
        </h2>

        {/* Ranking points */}
        <div className="mt-6 space-y-2">
          <div
            className="text-[10px] uppercase tracking-[0.35em]"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            {ranking.text}
          </div>
          <p
            className="text-lg font-medium"
            style={{ fontFamily: "var(--font-cormorant)", color: ranking.valueColor }}
          >
            {ranking.value}
          </p>
        </div>

        {/* Draw subtitle */}
        {isDraw && (
          <p
            className="mt-4 text-sm italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 53%, transparent)",
            }}
          >
            Forca equiparada. Nenhum duelista prevaleceu.
          </p>
        )}

        {/* Defeat subtitle */}
        {result === "DEFEAT" && (
          <p
            className="mt-4 text-sm italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 53%, transparent)",
            }}
          >
            A derrota e apenas o preco do aprendizado.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/battle")}
            className="w-full cursor-pointer py-3 text-xs uppercase tracking-[0.3em] text-white transition-transform duration-150 hover:-translate-y-px"
            style={{
              fontFamily: "var(--font-cinzel)",
              background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--ember) 100%)",
              border: "1px solid var(--ember)",
              boxShadow: "0 0 12px color-mix(in srgb, var(--ember) 20%, transparent)",
            }}
          >
            Jogar novamente
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full cursor-pointer py-3 transition-colors hover:text-white"
            style={{
              fontFamily: "var(--font-cinzel)",
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
            }}
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
