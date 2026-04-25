"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import { HOUSE_LORE } from "@/lib/constants-house";
import EmberField from "@/components/ui/EmberField";
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
      <div className="relative">
        <EmberField />
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 8%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0, transparent 55%),
              radial-gradient(ellipse at 88% 92%, color-mix(in srgb, var(--deep) 40%, transparent) 0, transparent 55%)`,
          }}
        />
        <div className="relative z-[2] flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
          {/* Hero */}
          <div className="text-center">
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.4em]"
              style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
            >
              PVE · Multiplos Inimigos
            </div>
            <h1
              className="text-[clamp(32px,5vw,48px)] font-medium text-white"
              style={{ fontFamily: "var(--font-cormorant)", lineHeight: 1 }}
            >
              Enfrente a Horda
            </h1>
            <p
              className="mx-auto mt-2 max-w-md text-[15px] italic"
              style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 67%, transparent)" }}
            >
              &laquo; A verdadeira forca se revela quando os numeros nao estao ao seu favor. &raquo;
            </p>
          </div>

          {/* Card de seleção */}
          <article
            className="relative w-full max-w-md overflow-hidden p-6"
            style={{
              background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
              border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
            }}
          >
            {/* Corner ticks */}
            {[
              { top: 0, left: 0, borderTop: "1px solid", borderLeft: "1px solid" },
              { top: 0, right: 0, borderTop: "1px solid", borderRight: "1px solid" },
              { bottom: 0, left: 0, borderBottom: "1px solid", borderLeft: "1px solid" },
              { bottom: 0, right: 0, borderBottom: "1px solid", borderRight: "1px solid" },
            ].map((pos, i) => (
              <span
                key={i}
                className="pointer-events-none absolute h-3 w-3"
                style={{
                  ...pos,
                  borderColor: "color-mix(in srgb, var(--gold) 40%, transparent)",
                }}
              />
            ))}

            {/* Glyph */}
            <div
              className="mb-3 text-center text-[36px]"
              style={{
                fontFamily: "var(--font-cormorant)",
                color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                lineHeight: 1,
              }}
            >
              &#9760;
            </div>

            {/* Formation visual */}
            <div
              className="mx-auto mb-5 grid max-w-[200px] items-center gap-2"
              style={{
                gridTemplateColumns: "1fr auto 1fr",
                padding: "12px 8px",
                background: "linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--ember) 4%, transparent) 100%)",
                border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
              }}
            >
              {/* Aliado */}
              <div className="flex justify-end">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 40% 35%, var(--ember), color-mix(in srgb, var(--ember) 20%, transparent))",
                    border: "1px solid var(--ember)",
                    boxShadow: "0 0 4px color-mix(in srgb, var(--ember) 27%, transparent)",
                  }}
                />
              </div>
              <span
                className="text-[11px] tracking-[0.15em]"
                style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 53%, transparent)" }}
              >
                ·vs·
              </span>
              {/* Inimigos */}
              <div className="flex gap-1">
                {Array.from({ length: selectedMode === "1v3" ? 3 : 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: "radial-gradient(circle at 40% 35%, var(--gold), color-mix(in srgb, var(--gold) 20%, transparent))",
                      border: "1px solid var(--gold)",
                      boxShadow: "0 0 4px color-mix(in srgb, var(--gold) 27%, transparent)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Difficulty tabs */}
            <div className="mb-4 flex gap-1">
              {(["1v3", "1v5"] as const).map((mode) => {
                const active = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2 transition-all"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      fontSize: 10,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      background: active ? "color-mix(in srgb, var(--ember) 14%, transparent)" : "color-mix(in srgb, var(--bg-secondary) 67%, transparent)",
                      border: `1px solid ${active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 14%, transparent)"}`,
                      color: active ? "#fff" : "color-mix(in srgb, var(--gold) 80%, transparent)",
                    }}
                  >
                    <span>{mode}</span>
                    <span
                      className="text-[10px] normal-case tracking-normal"
                      style={{
                        fontFamily: "var(--font-garamond)",
                        fontStyle: "italic",
                        letterSpacing: 0,
                        color: active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 47%, transparent)",
                      }}
                    >
                      {mode === "1v3" ? "Iniciante" : "Desafio"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hint */}
            <p
              className="mb-4 text-center text-xs italic"
              style={{
                fontFamily: "var(--font-garamond)",
                color: "color-mix(in srgb, var(--gold) 67%, transparent)",
              }}
            >
              {selectedMode === "1v3"
                ? "Enfrente 3 mobs — recomendado para iniciantes"
                : "Enfrente 5 mobs — maior desafio, mais EXP"}
            </p>

            {/* Reward hint */}
            <div
              className="mb-4 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "color-mix(in srgb, var(--gold) 60%, transparent)",
              }}
            >
              <span style={{ color: "var(--ember)" }}>&#10022;</span>
              {selectedMode === "1v3" ? "EXP x1.5 bonus" : "EXP x2.5 bonus"}
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={loading}
              className="w-full cursor-pointer py-3 text-xs uppercase tracking-[0.3em] text-white transition-transform duration-150 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                fontFamily: "var(--font-cinzel)",
                background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--ember) 100%)",
                border: "1px solid var(--ember)",
                boxShadow: "0 0 12px color-mix(in srgb, var(--ember) 20%, transparent)",
              }}
            >
              {loading ? "Iniciando..." : "Enfrentar Horda"}
            </button>
          </article>

          {/* Footer */}
          <footer
            className="text-center text-xs italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 40%, transparent)",
            }}
          >
            &laquo; {profile?.house?.name && HOUSE_LORE[profile.house.name]
              ? HOUSE_LORE[profile.house.name].motto
              : "O conhecimento e a chave, a disciplina e o caminho"} &raquo;
          </footer>
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
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{
            background: "rgba(5, 3, 10, 0.82)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            animation: "matchPop 380ms cubic-bezier(.2,1.2,.3,1)",
          }}
        >
          <div
            className="mx-4 w-full max-w-md p-8 text-center"
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
                color: battleResult.result === "VICTORY" ? "var(--ember)" : "#d96a52",
                textShadow: battleResult.result === "VICTORY" ? "0 0 12px color-mix(in srgb, var(--ember) 33%, transparent)" : "none",
              }}
            >
              {battleResult.result === "VICTORY" ? "Vitoria!" : "Derrota"}
            </h2>

            {battleResult.result === "VICTORY" && (
              <div className="mt-6 space-y-2">
                <div
                  className="text-[10px] uppercase tracking-[0.35em]"
                  style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
                >
                  Recompensa
                </div>
                <p className="text-lg font-medium" style={{ fontFamily: "var(--font-cormorant)", color: "var(--ember)" }}>
                  +{battleResult.expGained} EXP
                </p>
                {battleResult.levelsGained > 0 && (
                  <p className="text-lg font-bold animate-pulse" style={{ fontFamily: "var(--font-cormorant)", color: "var(--accent-primary)" }}>
                    Level Up! Nivel {battleResult.newLevel}
                  </p>
                )}
              </div>
            )}

            {battleResult.result === "DEFEAT" && (
              <p className="mt-4 text-sm italic" style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 53%, transparent)" }}>
                A derrota e apenas o preco do aprendizado.
              </p>
            )}

            <div className="mt-8 flex flex-col gap-2.5">
              <button type="button" onClick={handlePlayAgain}
                className="w-full cursor-pointer py-3 text-xs uppercase tracking-[0.3em] text-white transition-transform duration-150 hover:-translate-y-px"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--ember) 100%)",
                  border: "1px solid var(--ember)",
                  boxShadow: "0 0 12px color-mix(in srgb, var(--ember) 20%, transparent)",
                }}>
                Jogar novamente
              </button>
              <button type="button" onClick={handleGoHome}
                className="w-full cursor-pointer py-3 transition-colors hover:text-white"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  background: "transparent",
                  border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
                }}>
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
