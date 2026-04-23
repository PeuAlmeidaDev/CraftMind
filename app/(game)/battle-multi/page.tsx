"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import MultiBattleArena from "./_components/MultiBattleArena";

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
};

export type PveBattleResult = {
  result: "VICTORY" | "DEFEAT";
  expGained: number;
  levelsGained: number;
  newLevel: number;
};

export type PlayerProfile = {
  name: string;
  avatarUrl: string | null;
  house: { name: string } | null;
};

export type MultiMobInfo = {
  name: string;
  tier: number;
  hp: number;
  maxHp: number;
  index: number;
  playerId: string;
  defeated: boolean;
  statusEffects: ActiveStatusEffect[];
  imageUrl: string | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BattleMultiPage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<"IDLE" | "BATTLE" | "RESULT">("IDLE");
  const [selectedMode, setSelectedMode] = useState<"1v3" | "1v5">("1v3");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [mobs, setMobs] = useState<MultiMobInfo[]>([]);
  const [playerHp, setPlayerHp] = useState(0);
  const [playerMaxHp, setPlayerMaxHp] = useState(0);
  const [events, setEvents] = useState<TurnLogEntry[]>([]);
  const [battleResult, setBattleResult] = useState<PveBattleResult | null>(null);
  const [skills, setSkills] = useState<AvailableSkill[]>([]);
  const [playerStatusEffects, setPlayerStatusEffects] = useState<ActiveStatusEffect[]>([]);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);

  // -------------------------------------------------------------------------
  // Abort in-flight fetches on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch player profile on mount
  // -------------------------------------------------------------------------

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
          data: { id: string; name: string; avatarUrl: string | null; house: { name: string } | null };
        }>;
      })
      .then((json) => {
        if (json) {
          setPlayerId(json.data.id);
          setProfile({
            name: json.data.name,
            avatarUrl: json.data.avatarUrl,
            house: json.data.house ?? null,
          });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => ac.abort();
  }, [router]);

  // -------------------------------------------------------------------------
  // Check for active battle on mount (reconnection)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();

    const checkActiveBattle = async () => {
      try {
        const activeRes = await fetch(
          "/api/battle/active",
          authFetchOptions(token, ac.signal),
        );

        if (activeRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!activeRes.ok) {
          setCheckingActive(false);
          return;
        }

        const activeJson = (await activeRes.json()) as {
          data:
            | { hasBattle: true; battleType: string; battleId: string }
            | { hasBattle: false };
        };

        if (!activeJson.data.hasBattle || activeJson.data.battleType !== "pve-multi") {
          setCheckingActive(false);
          return;
        }

        const activeBattleId = activeJson.data.battleId;

        // Fetch full state to restore
        const stateRes = await fetch(
          `/api/battle/pve-multi/state?battleId=${encodeURIComponent(activeBattleId)}`,
          authFetchOptions(token, ac.signal),
        );

        if (stateRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!stateRes.ok) {
          setCheckingActive(false);
          return;
        }

        const stateJson = (await stateRes.json()) as {
          data: {
            battleOver?: boolean;
            battleId: string;
            mode: "1v3" | "1v5";
            playerHp: number;
            playerMaxHp: number;
            playerStatusEffects: ActiveStatusEffect[];
            playerCooldowns: Record<string, number>;
            playerSkills: AvailableSkill[];
            mobs: Array<{
              index: number;
              hp: number;
              maxHp: number;
              defeated: boolean;
              name: string;
              tier: number;
              imageUrl: string | null;
              playerId: string;
              statusEffects: ActiveStatusEffect[];
            }>;
          };
        };

        const sd = stateJson.data;

        // Battle may have timed out
        if (sd.battleOver) {
          setCheckingActive(false);
          return;
        }

        setBattleId(sd.battleId);
        setSelectedMode(sd.mode);
        setPlayerHp(sd.playerHp);
        setPlayerMaxHp(sd.playerMaxHp);
        setPlayerStatusEffects(sd.playerStatusEffects);
        setSkills(sd.playerSkills);
        setMobs(
          sd.mobs.map((m) => ({
            name: m.name,
            tier: m.tier,
            hp: m.hp,
            maxHp: m.maxHp,
            index: m.index,
            playerId: m.playerId,
            defeated: m.defeated,
            statusEffects: m.statusEffects,
            imageUrl: m.imageUrl,
          })),
        );
        setEvents([]);
        setBattleResult(null);
        setPhase("BATTLE");
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) {
          setCheckingActive(false);
        }
      }
    };

    checkActiveBattle();

    return () => ac.abort();
  }, [router]);

  // -------------------------------------------------------------------------
  // Start multi battle
  // -------------------------------------------------------------------------

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
      const startRes = await fetch("/api/battle/pve-multi/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        signal: ac.signal,
        body: JSON.stringify({ mode: selectedMode }),
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
          mode: "1v3" | "1v5";
          mobs: Array<{ name: string; tier: number; hp: number; index: number; playerId: string; imageUrl: string | null }>;
          player: { hp: number; skills: string[] };
          initialState: { turnNumber: number; playerHp: number; mobsHp: number[] };
        };
      };

      const { data } = startJson;

      setBattleId(data.battleId);
      setPlayerHp(data.initialState.playerHp);
      setPlayerMaxHp(data.initialState.playerHp);
      setMobs(
        data.mobs.map((m, i) => ({
          name: m.name,
          tier: m.tier,
          hp: data.initialState.mobsHp[i],
          maxHp: m.hp,
          index: m.index,
          playerId: m.playerId,
          defeated: false,
          statusEffects: [],
          imageUrl: m.imageUrl,
        }))
      );
      setEvents([]);
      setBattleResult(null);
      setPhase("BATTLE");

      // 2. Fetch character skills
      const charRes = await fetch("/api/character", authFetchOptions(token, ac.signal));

      if (charRes.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (charRes.ok) {
        const charJson = (await charRes.json()) as {
          data: {
            skills: Array<{
              equipped: boolean;
              slotIndex: number;
              skill: {
                id: string;
                name: string;
                description: string;
                basePower: number;
                damageType: string;
                target: string;
                cooldown: number;
                accuracy: number;
              };
            }>;
          };
        };

        const equipped = charJson.data.skills
          .filter((cs) => cs.equipped)
          .map((cs) => ({
            skillId: cs.skill.id,
            slotIndex: cs.slotIndex,
            name: cs.skill.name,
            description: cs.skill.description,
            basePower: cs.skill.basePower,
            damageType: cs.skill.damageType,
            target: cs.skill.target,
            cooldown: 0,
            accuracy: cs.skill.accuracy,
          }));

        setSkills(equipped);
      }

      // 3. Fetch initial state for cooldowns
      const stateRes = await fetch(
        `/api/battle/pve-multi/state?battleId=${encodeURIComponent(data.battleId)}`,
        authFetchOptions(token, ac.signal)
      );

      if (stateRes.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (stateRes.ok) {
        const stateJson = (await stateRes.json()) as {
          data: {
            playerHp: number;
            playerMaxHp: number;
            playerStatusEffects: Array<{ status: string; remainingTurns: number }>;
            playerCooldowns: Record<string, number>;
            mobs: Array<{
              index: number;
              hp: number;
              maxHp: number;
              defeated: boolean;
              statusEffects: Array<{ status: string; remainingTurns: number }>;
            }>;
          };
        };

        const sd = stateJson.data;
        setPlayerStatusEffects(sd.playerStatusEffects);
        setSkills((prev) =>
          prev.map((s) => ({
            ...s,
            cooldown: sd.playerCooldowns[s.skillId] ?? 0,
          }))
        );
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      alert("Erro de conexao. Tente novamente.");
      setPhase("IDLE");
    } finally {
      setLoading(false);
    }
  }, [router, selectedMode]);

  // -------------------------------------------------------------------------
  // Action handler
  // -------------------------------------------------------------------------

  const handleAction = useCallback(
    async (skillId: string | null, targetIndex?: number) => {
      const token = getToken();
      if (!token) {
        clearAuthAndRedirect(router);
        return;
      }

      setActing(true);

      try {
        const res = await fetch("/api/battle/pve-multi/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({ battleId, skillId, targetIndex }),
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
            mobsHp: number[];
            mobsDefeated: boolean[];
            battleOver: boolean;
            result: "VICTORY" | "DEFEAT" | null;
            reason?: "INACTIVITY_TIMEOUT";
            expGained: number;
            levelsGained?: number;
            newLevel?: number;
          };
        };

        const { data } = json;

        // Timeout por inatividade — mostrar resultado direto
        if (data.reason === "INACTIVITY_TIMEOUT") {
          setBattleResult({
            result: "DEFEAT",
            expGained: 0,
            levelsGained: 0,
            newLevel: 0,
          });
          return;
        }

        setEvents((prev) => [...prev, ...data.events]);
        setPlayerHp(data.playerHp);
        setMobs((prev) =>
          prev.map((m, i) => ({
            ...m,
            hp: data.mobsHp[i],
            defeated: data.mobsDefeated[i],
          }))
        );

        // Re-fetch state for cooldowns and status effects
        const stateRes = await fetch(
          `/api/battle/pve-multi/state?battleId=${encodeURIComponent(battleId!)}`,
          authFetchOptions(token)
        );

        if (stateRes.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (stateRes.ok) {
          const stateJson = (await stateRes.json()) as {
            data: {
              playerHp: number;
              playerMaxHp: number;
              playerStatusEffects: Array<{ status: string; remainingTurns: number }>;
              playerCooldowns: Record<string, number>;
              mobs: Array<{
                index: number;
                hp: number;
                maxHp: number;
                defeated: boolean;
                statusEffects: Array<{ status: string; remainingTurns: number }>;
              }>;
            };
          };

          const sd = stateJson.data;
          setPlayerStatusEffects(sd.playerStatusEffects);
          setSkills((prev) =>
            prev.map((s) => ({
              ...s,
              cooldown: sd.playerCooldowns[s.skillId] ?? 0,
            }))
          );
          setMobs((prev) =>
            prev.map((m) => {
              const mobState = sd.mobs.find((ms) => ms.index === m.index);
              if (!mobState) return m;
              return {
                ...m,
                statusEffects: mobState.statusEffects,
              };
            })
          );
        }

        if (data.battleOver && data.result) {
          const r: PveBattleResult = {
            result: data.result,
            expGained: data.expGained,
            levelsGained: data.levelsGained ?? 0,
            newLevel: data.newLevel ?? 0,
          };
          setBattleResult(r);
        }
      } catch {
        alert("Erro de conexao. Tente novamente.");
      } finally {
        setActing(false);
      }
    },
    [battleId, router]
  );

  // -------------------------------------------------------------------------
  // Forfeit handler
  // -------------------------------------------------------------------------

  const handleForfeit = useCallback(async () => {
    if (!battleId) return;

    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    setActing(true);

    try {
      const res = await fetch("/api/battle/pve-multi/forfeit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ battleId }),
      });

      if (res.status === 401) {
        clearAuthAndRedirect(router);
        return;
      }

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(errorBody?.error ?? "Erro ao desistir");
        return;
      }

      setBattleResult({
        result: "DEFEAT",
        expGained: 0,
        levelsGained: 0,
        newLevel: 0,
      });
    } catch {
      alert("Erro de conexao. Tente novamente.");
    } finally {
      setActing(false);
    }
  }, [battleId, router]);

  // -------------------------------------------------------------------------
  // Play again / go home
  // -------------------------------------------------------------------------

  const handlePlayAgain = useCallback(() => {
    setBattleId(null);
    setMobs([]);
    setPlayerHp(0);
    setPlayerMaxHp(0);
    setEvents([]);
    setBattleResult(null);
    setSkills([]);
    setPlayerStatusEffects([]);
    setActing(false);
    setPhase("IDLE");
  }, []);

  const handleGoHome = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (checkingActive) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
          <p className="text-sm text-gray-400">Verificando batalha...</p>
        </div>
      </div>
    );
  }

  if (phase === "IDLE") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="max-w-sm w-full rounded-xl border border-[var(--border-subtle)] p-8 text-center"
          style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}
        >
          <div className="text-5xl mb-4">&#9876;&#65039;</div>
          <h1 className="text-xl font-bold text-white mb-2">Batalha Multi</h1>
          <p className="text-sm text-gray-400 mb-6">
            Enfrente multiplos mobs simultaneamente. Escolha seus alvos com sabedoria.
          </p>

          {/* Mode selector */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setSelectedMode("1v3")}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold border transition ${
                selectedMode === "1v3"
                  ? "bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-white"
                  : "border-[var(--border-subtle)] text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              1v3
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode("1v5")}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold border transition ${
                selectedMode === "1v5"
                  ? "bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-white"
                  : "border-[var(--border-subtle)] text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              1v5
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            {selectedMode === "1v3"
              ? "Enfrente 3 mobs — recomendado para iniciantes"
              : "Enfrente 5 mobs — maior desafio, mais EXP"}
          </p>

          <button
            type="button"
            onClick={handleStartBattle}
            disabled={loading}
            className={`w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition ${
              loading ? "opacity-60 cursor-not-allowed" : "hover:brightness-110"
            }`}
          >
            {loading ? "Iniciando..." : "Iniciar Batalha"}
          </button>
        </div>
      </div>
    );
  }

  // phase === "BATTLE" or with result overlay
  return (
    <div className="relative">
      <MultiBattleArena
        mobs={mobs}
        profile={profile!}
        playerId={playerId}
        playerHp={playerHp}
        playerMaxHp={playerMaxHp}
        playerStatusEffects={playerStatusEffects}
        events={events}
        skills={skills}
        onAction={handleAction}
        onForfeit={handleForfeit}
        acting={acting}
      />

      {/* Result modal overlay */}
      {battleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div
            className="max-w-md w-full mx-4 rounded-xl border border-[var(--border-subtle)] p-8 text-center animate-scale-in"
            style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}
          >
            <div className="text-6xl">
              {battleResult.result === "VICTORY" ? "\uD83C\uDFC6" : "\uD83D\uDC80"}
            </div>

            <h2
              className={`text-2xl font-bold mt-4 ${
                battleResult.result === "VICTORY" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {battleResult.result === "VICTORY" ? "Vitoria!" : "Derrota"}
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
