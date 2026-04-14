"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import BattleIdle from "./_components/BattleIdle";
import BattleArena from "./_components/BattleArena";

// ---------------------------------------------------------------------------
// Types (exported for child components)
// ---------------------------------------------------------------------------

export type TurnLogEntry = {
  turn: number;
  phase: string;
  actorId?: string;
  targetId?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  healing?: number;
  statusApplied?: string;
  statusDamage?: number;
  buffApplied?: { stat: string; value: number; duration: number };
  debuffApplied?: { stat: string; value: number; duration: number };
  counterTriggered?: boolean;
  missed?: boolean;
  comboStack?: number;
  message: string;
};

export type AvailableSkill = {
  skillId: string;
  slotIndex: number;
  name: string;
  description: string;
  basePower: number;
  damageType: string;
  target: string;
  cooldown: number;
  accuracy: number;
};

export type ActiveStatusEffect = {
  status: string;
  remainingTurns: number;
  turnsElapsed: number;
};

export type MobInfo = {
  name: string;
  description: string;
  tier: number;
  hp: number;
  aiProfile: string;
};

export type PveBattleResult = {
  result: "VICTORY" | "DEFEAT" | "DRAW";
  expGained: number;
  levelsGained: number;
  newLevel: number;
};

export type PlayerProfile = {
  name: string;
  avatarUrl: string | null;
  house: { name: string } | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BattlePage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<"IDLE" | "BATTLE" | "RESULT">("IDLE");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [mobId, setMobId] = useState<string | null>(null);
  const [mob, setMob] = useState<MobInfo | null>(null);
  const [playerHp, setPlayerHp] = useState(0);
  const [mobHp, setMobHp] = useState(0);
  const [playerMaxHp, setPlayerMaxHp] = useState(0);
  const [mobMaxHp, setMobMaxHp] = useState(0);
  const [events, setEvents] = useState<TurnLogEntry[]>([]);
  const [battleResult, setBattleResult] = useState<PveBattleResult | null>(null);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [playerStatusEffects, setPlayerStatusEffects] = useState<ActiveStatusEffect[]>([]);
  const [mobStatusEffects, setMobStatusEffects] = useState<ActiveStatusEffect[]>([]);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  // -----------------------------------------------------------------------
  // Abort in-flight fetches on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Fetch player profile on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;

    fetch("/api/user/profile", authFetchOptions(token, ac.signal))
      .then((res) => {
        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<{
          data: { name: string; avatarUrl: string | null; house: { name: string } | null };
        }>;
      })
      .then((json) => {
        if (json) {
          setProfile({
            name: json.data.name,
            avatarUrl: json.data.avatarUrl,
            house: json.data.house ?? null,
          });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Network error — keep page without profile data
      });

    return () => ac.abort();
  }, [router]);

  // -----------------------------------------------------------------------
  // Start PvE battle
  // -----------------------------------------------------------------------

  const handleStartBattle = useCallback(async () => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // 1. Start battle
      const startRes = await fetch("/api/battle/pve/start", {
        method: "POST",
        ...authFetchOptions(token, ac.signal),
      });

      if (startRes.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (!startRes.ok) {
        const errorBody = (await startRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(errorBody?.error ?? "Erro ao iniciar batalha");
        return;
      }

      const startJson = (await startRes.json()) as {
        data: {
          battleId: string;
          playerId: string;
          mobId: string;
          mob: MobInfo;
          player: { hp: number };
          initialState: { playerHp: number; mobHp: number };
        };
      };

      const { data } = startJson;

      setBattleId(data.battleId);
      setPlayerId(data.playerId);
      setMobId(data.mobId);
      setMob(data.mob);
      setPlayerHp(data.initialState.playerHp);
      setPlayerMaxHp(data.initialState.playerHp);
      setMobHp(data.initialState.mobHp);
      setMobMaxHp(data.mob.hp);
      setEvents([]);
      setBattleResult(null);
      setPhase("BATTLE");

      // 2. Fetch initial battle state (skills, status effects)
      const stateRes = await fetch(
        `/api/battle/pve/state?battleId=${encodeURIComponent(data.battleId)}`,
        authFetchOptions(token, ac.signal),
      );

      if (stateRes.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (stateRes.ok) {
        const stateJson = (await stateRes.json()) as {
          data: {
            player: {
              availableSkills: AvailableSkill[];
              statusEffects: ActiveStatusEffect[];
            };
            mob: {
              statusEffects: ActiveStatusEffect[];
            };
          };
        };

        setAvailableSkills(stateJson.data.player.availableSkills);
        setPlayerStatusEffects(stateJson.data.player.statusEffects);
        setMobStatusEffects(stateJson.data.mob.statusEffects);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      alert("Erro de conexao. Tente novamente.");
      setPhase("IDLE");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // -----------------------------------------------------------------------
  // Action handler
  // -----------------------------------------------------------------------

  const handleAction = useCallback(
    async (skillId: string | null) => {
      const token = getToken();
      if (!token) {
        clearAuthAndRedirect(router);
        return;
      }

      setActing(true);

      try {
        const res = await fetch("/api/battle/pve/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({ battleId, skillId }),
        });

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          alert(errorBody?.error ?? "Erro ao executar acao");
          return;
        }

        const json = (await res.json()) as {
          data: {
            events: TurnLogEntry[];
            playerHp: number;
            mobHp: number;
            battleOver: boolean;
            result?: "VICTORY" | "DEFEAT" | "DRAW";
            expGained?: number;
            levelsGained?: number;
            newLevel?: number;
          };
        };

        const { data } = json;

        setEvents((prev) => [...prev, ...data.events]);
        setPlayerHp(data.playerHp);
        setMobHp(data.mobHp);

        // Re-fetch battle state for updated skills and status effects
        const stateRes = await fetch(
          `/api/battle/pve/state?battleId=${encodeURIComponent(battleId!)}`,
          authFetchOptions(token),
        );

        if (stateRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (stateRes.ok) {
          const stateJson = (await stateRes.json()) as {
            data: {
              player: {
                availableSkills: AvailableSkill[];
                statusEffects: ActiveStatusEffect[];
              };
              mob: {
                statusEffects: ActiveStatusEffect[];
              };
            };
          };

          setAvailableSkills(stateJson.data.player.availableSkills);
          setPlayerStatusEffects(stateJson.data.player.statusEffects);
          setMobStatusEffects(stateJson.data.mob.statusEffects);
        }

        if (data.battleOver) {
          const r: PveBattleResult = {
            result: data.result!,
            expGained: data.expGained!,
            levelsGained: data.levelsGained!,
            newLevel: data.newLevel!,
          };
          setBattleResult(r);
        }
      } catch {
        alert("Erro de conexao. Tente novamente.");
      } finally {
        setActing(false);
      }
    },
    [battleId, router],
  );

  const handleSkillUse = useCallback(
    (skillId: string) => {
      handleAction(skillId);
    },
    [handleAction],
  );

  const handleSkipTurn = useCallback(() => {
    handleAction(null);
  }, [handleAction]);

  const handlePlayAgain = useCallback(() => {
    setBattleId(null);
    setMob(null);
    setPlayerHp(0);
    setMobHp(0);
    setPlayerMaxHp(0);
    setMobMaxHp(0);
    setEvents([]);
    setBattleResult(null);
    setAvailableSkills([]);
    setPlayerStatusEffects([]);
    setMobStatusEffects([]);
    setActing(false);
    setPhase("IDLE");
  }, []);

  const handleGoHome = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (phase === "IDLE") {
    return <BattleIdle onStart={handleStartBattle} loading={loading} />;
  }

  // phase === "BATTLE" ou "RESULT" (resultado agora e modal sobre a arena)
  return (
    <div className="relative">
      <BattleArena
        mob={mob!}
        profile={profile!}
        playerId={playerId}
        mobId={mobId}
        playerHp={playerHp}
        playerMaxHp={playerMaxHp}
        mobHp={mobHp}
        mobMaxHp={mobMaxHp}
        playerStatusEffects={playerStatusEffects}
        mobStatusEffects={mobStatusEffects}
        events={events}
        availableSkills={availableSkills}
        onSkillUse={handleSkillUse}
        onSkipTurn={handleSkipTurn}
        acting={acting}
      />

      {/* Modal de resultado sobre a arena */}
      {battleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="max-w-md w-full mx-4 rounded-xl border border-[var(--border-subtle)] p-8 text-center animate-scale-in" style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}>
            <div className="text-6xl">
              {battleResult.result === "VICTORY" ? "\uD83C\uDFC6" : battleResult.result === "DEFEAT" ? "\uD83D\uDC80" : "\uD83E\uDD1D"}
            </div>

            <h2 className={`text-2xl font-bold mt-4 ${
              battleResult.result === "VICTORY" ? "text-emerald-400"
              : battleResult.result === "DEFEAT" ? "text-red-400"
              : "text-gray-400"
            }`}>
              {battleResult.result === "VICTORY" ? "Vitoria!" : battleResult.result === "DEFEAT" ? "Derrota" : "Empate"}
            </h2>

            {battleResult.result === "VICTORY" && (
              <div className="mt-6 space-y-2">
                <p className="text-lg text-amber-400 font-semibold">
                  EXP ganho: +{battleResult.expGained}
                </p>
                {battleResult.levelsGained > 0 && (
                  <p className="text-lg text-[var(--accent-primary)] font-bold animate-pulse">
                    Level Up! Nivel {battleResult.newLevel}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={handlePlayAgain}
                className="w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:brightness-110 transition"
              >
                Jogar novamente
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full cursor-pointer rounded-lg py-3 text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
            .animate-fade-in {
              animation: fadeIn 0.3s ease-out forwards;
            }
            .animate-scale-in {
              animation: scaleIn 0.3s ease-out forwards;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
