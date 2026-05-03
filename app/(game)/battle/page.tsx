"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import { HOUSE_LORE } from "@/lib/constants-house";
import EmberField from "@/components/ui/EmberField";
import BattleIdle from "./_components/BattleIdle";
import BattleArena from "./_components/BattleArena";
import CardDropReveal from "./_components/CardDropReveal";
import type { DroppedCard } from "./_components/CardDropReveal";
import type { DamageType } from "@/types/skill";

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
  damageType?: DamageType;
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
  /** True quando esta skill vem do 5o slot (Cristal Espectral, purity 100). */
  fromSpectralCard?: boolean;
};

export type ActiveStatusEffect = {
  status: string;
  remainingTurns: number;
  turnsElapsed: number;
};

/** Buff/Debuff/PriorityShift ativo, sanitizado (sem id/onExpire). */
export type ActiveBuffSummary = {
  source: "BUFF" | "DEBUFF" | "PRIORITY_SHIFT";
  stat: string;
  value: number;
  remainingTurns: number;
};

/** Vulnerabilidade ativa, sanitizada (sem id). */
export type ActiveVulnerabilitySummary = {
  damageType: "PHYSICAL" | "MAGICAL" | "NONE";
  percent: number;
  remainingTurns: number;
};

/** Counter ativo, sanitizado (sem id/onTrigger). */
export type ActiveCounterSummary = {
  powerMultiplier: number;
  remainingTurns: number;
};

export type MobInfo = {
  name: string;
  description: string;
  tier: number;
  hp: number;
  aiProfile: string;
  imageUrl: string | null;
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

// Response type for GET /api/battle/active
type ActiveBattleData =
  | { hasBattle: true; battleType: "pve" | "pve-multi" | "pvp" | "boss" | "coop-pve"; battleId: string }
  | { hasBattle: false };

// Response shape for GET /api/battle/pve/state (with mob info for reconnection)
type PveStateData = {
  battleId: string;
  turnNumber: number;
  status: string;
  player: {
    currentHp: number;
    maxHp: number;
    availableSkills: AvailableSkill[];
    statusEffects: ActiveStatusEffect[];
    buffs: ActiveBuffSummary[];
    vulnerabilities: ActiveVulnerabilitySummary[];
    counters: ActiveCounterSummary[];
  };
  mob: {
    currentHp: number;
    maxHp: number;
    statusEffects: ActiveStatusEffect[];
    buffs: ActiveBuffSummary[];
    vulnerabilities: ActiveVulnerabilitySummary[];
    counters: ActiveCounterSummary[];
    name: string;
    description: string;
    tier: number;
    imageUrl: string | null;
  };
};

export default function BattlePage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [checkingActive, setCheckingActive] = useState(true);
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
  const [playerBuffs, setPlayerBuffs] = useState<ActiveBuffSummary[]>([]);
  const [mobBuffs, setMobBuffs] = useState<ActiveBuffSummary[]>([]);
  const [playerVulnerabilities, setPlayerVulnerabilities] = useState<ActiveVulnerabilitySummary[]>([]);
  const [mobVulnerabilities, setMobVulnerabilities] = useState<ActiveVulnerabilitySummary[]>([]);
  const [playerCounters, setPlayerCounters] = useState<ActiveCounterSummary[]>([]);
  const [mobCounters, setMobCounters] = useState<ActiveCounterSummary[]>([]);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [cardDropped, setCardDropped] = useState<DroppedCard | null>(null);
  const [showCardReveal, setShowCardReveal] = useState(false);
  /** Indica se o jogador tem ao menos 1 cristal Espectral (purity 100) equipado.
   *  Usado pelo BattleArena para aplicar overlay holografico no painel. */
  const [hasEquippedSpectral, setHasEquippedSpectral] = useState(false);

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
  // Detect equipped Espectral (purity 100) — para overlay holografico
  // -----------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const ac = new AbortController();
    fetch("/api/cards", authFetchOptions(token, ac.signal))
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data: { userCards: Array<{ equipped: boolean; purity: number }> } } | null) => {
        if (!json) return;
        const has = json.data.userCards.some(
          (uc) => uc.equipped && uc.purity === 100,
        );
        setHasEquippedSpectral(has);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ac.abort();
  }, []);

  // -----------------------------------------------------------------------
  // Check for active battle on mount (reconnection)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();

    const checkActiveBattle = async () => {
      try {
        // 1. Check if user has an active battle
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

        const activeJson = (await activeRes.json()) as { data: ActiveBattleData };
        const activeData = activeJson.data;

        if (!activeData.hasBattle) {
          setCheckingActive(false);
          return;
        }

        // 2. Handle based on battle type
        switch (activeData.battleType) {
          case "pve": {
            // Fetch full state to restore the battle
            const stateRes = await fetch(
              `/api/battle/pve/state?battleId=${encodeURIComponent(activeData.battleId)}`,
              authFetchOptions(token, ac.signal),
            );

            if (stateRes.status === 401) {
              clearAuthAndRedirect(router);
              return;
            }

            if (!stateRes.ok) {
              // Battle may have expired between checks
              setCheckingActive(false);
              return;
            }

            const stateJson = (await stateRes.json()) as { data: PveStateData };
            const s = stateJson.data;

            setBattleId(s.battleId);
            setPlayerId(s.player.currentHp > 0 ? "player" : null);
            setMobId(null);
            setMob({
              name: s.mob.name,
              description: s.mob.description,
              tier: s.mob.tier,
              hp: s.mob.maxHp,
              aiProfile: "BALANCED",
              imageUrl: s.mob.imageUrl,
            });
            setPlayerHp(s.player.currentHp);
            setPlayerMaxHp(s.player.maxHp);
            setMobHp(s.mob.currentHp);
            setMobMaxHp(s.mob.maxHp);
            setAvailableSkills(s.player.availableSkills);
            setPlayerStatusEffects(s.player.statusEffects);
            setMobStatusEffects(s.mob.statusEffects);
            setPlayerBuffs(s.player.buffs);
            setMobBuffs(s.mob.buffs);
            setPlayerVulnerabilities(s.player.vulnerabilities);
            setMobVulnerabilities(s.mob.vulnerabilities);
            setPlayerCounters(s.player.counters);
            setMobCounters(s.mob.counters);
            setEvents([]);
            setBattleResult(null);
            setPhase("BATTLE");
            break;
          }

          case "pve-multi": {
            // PvE Multi has its own page — redirect
            router.push("/battle-multi");
            return;
          }

          case "pvp": {
            // PvP uses Socket.io — the server handles reconnection on connect event
            // Stay on /battle; socket reconnection handler will emit battle:state
            setCheckingActive(false);
            return;
          }

          case "boss": {
            // Boss Fight has its own page
            router.push("/boss-fight");
            return;
          }

          case "coop-pve": {
            // Coop PvE has its own page
            router.push("/coop-pve");
            return;
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Network error — fall through to idle
      } finally {
        if (!ac.signal.aborted) {
          setCheckingActive(false);
        }
      }
    };

    checkActiveBattle();

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
              buffs: ActiveBuffSummary[];
              vulnerabilities: ActiveVulnerabilitySummary[];
              counters: ActiveCounterSummary[];
            };
            mob: {
              statusEffects: ActiveStatusEffect[];
              buffs: ActiveBuffSummary[];
              vulnerabilities: ActiveVulnerabilitySummary[];
              counters: ActiveCounterSummary[];
            };
          };
        };

        setAvailableSkills(stateJson.data.player.availableSkills);
        setPlayerStatusEffects(stateJson.data.player.statusEffects);
        setMobStatusEffects(stateJson.data.mob.statusEffects);
        setPlayerBuffs(stateJson.data.player.buffs);
        setMobBuffs(stateJson.data.mob.buffs);
        setPlayerVulnerabilities(stateJson.data.player.vulnerabilities);
        setMobVulnerabilities(stateJson.data.mob.vulnerabilities);
        setPlayerCounters(stateJson.data.player.counters);
        setMobCounters(stateJson.data.mob.counters);
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
            reason?: "INACTIVITY_TIMEOUT";
            expGained?: number;
            levelsGained?: number;
            newLevel?: number;
            cardDropped?: {
              id: string;
              name: string;
              rarity: string;
              mobId: string;
              flavorText?: string;
              purity?: number;
            } | null;
          };
        };

        const { data } = json;

        // Timeout por inatividade
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
                buffs: ActiveBuffSummary[];
                vulnerabilities: ActiveVulnerabilitySummary[];
                counters: ActiveCounterSummary[];
              };
              mob: {
                statusEffects: ActiveStatusEffect[];
                buffs: ActiveBuffSummary[];
                vulnerabilities: ActiveVulnerabilitySummary[];
                counters: ActiveCounterSummary[];
              };
            };
          };

          setAvailableSkills(stateJson.data.player.availableSkills);
          setPlayerStatusEffects(stateJson.data.player.statusEffects);
          setMobStatusEffects(stateJson.data.mob.statusEffects);
          setPlayerBuffs(stateJson.data.player.buffs);
          setMobBuffs(stateJson.data.mob.buffs);
          setPlayerVulnerabilities(stateJson.data.player.vulnerabilities);
          setMobVulnerabilities(stateJson.data.mob.vulnerabilities);
          setPlayerCounters(stateJson.data.player.counters);
          setMobCounters(stateJson.data.mob.counters);
        }

        if (data.battleOver) {
          const r: PveBattleResult = {
            result: data.result!,
            expGained: data.expGained!,
            levelsGained: data.levelsGained!,
            newLevel: data.newLevel!,
          };
          // Se houve drop de cristal, exibir reveal ANTES do resultado padrao.
          // Hidrata DroppedCard usando mob corrente (mob.imageUrl/name/tier).
          if (data.cardDropped && mob) {
            const drop = data.cardDropped;
            const validRarity = ["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"].includes(
              drop.rarity,
            );
            if (validRarity) {
              const hydrated: DroppedCard = {
                id: drop.id,
                name: drop.name,
                flavorText: drop.flavorText ?? "Um fragmento da memoria desta criatura, cristalizado no eclipse.",
                rarity: drop.rarity as DroppedCard["rarity"],
                purity: drop.purity,
                mob: {
                  id: drop.mobId,
                  name: mob.name,
                  tier: mob.tier,
                  imageUrl: mob.imageUrl,
                },
              };
              setCardDropped(hydrated);
              setShowCardReveal(true);
            }
          }
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

  // -----------------------------------------------------------------------
  // Forfeit handler
  // -----------------------------------------------------------------------

  const handleForfeit = useCallback(async () => {
    if (!battleId) return;

    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    setActing(true);

    try {
      const res = await fetch("/api/battle/pve/forfeit", {
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
  }, [battleId, mob, router]);

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
    setPlayerBuffs([]);
    setMobBuffs([]);
    setPlayerVulnerabilities([]);
    setMobVulnerabilities([]);
    setPlayerCounters([]);
    setMobCounters([]);
    setActing(false);
    setCardDropped(null);
    setShowCardReveal(false);
    setPhase("IDLE");
  }, []);

  const handleGoHome = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
        <div className="relative z-[2]">
          <BattleIdle
            onStart={handleStartBattle}
            loading={loading}
            playerName={profile?.name ?? null}
            houseName={profile?.house?.name ?? null}
          />
        </div>
      </div>
    );
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
        playerBuffs={playerBuffs}
        mobBuffs={mobBuffs}
        playerVulnerabilities={playerVulnerabilities}
        mobVulnerabilities={mobVulnerabilities}
        playerCounters={playerCounters}
        mobCounters={mobCounters}
        events={events}
        availableSkills={availableSkills}
        onSkillUse={handleSkillUse}
        onSkipTurn={handleSkipTurn}
        onForfeit={handleForfeit}
        acting={acting}
        hasEquippedSpectral={hasEquippedSpectral}
      />

      {/* Modal de resultado sobre a arena */}
      {battleResult && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-6"
          style={{
            background: "rgba(5, 3, 10, 0.85)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            animation: "modalFade 400ms ease-out",
          }}
        >
          <div
            className="relative mx-4 w-full max-w-[440px] overflow-hidden text-center"
            style={{
              padding: "38px 32px 28px",
              background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
              border: battleResult.result === "VICTORY"
                ? "1px solid var(--ember)"
                : "1px solid #b82b24",
              boxShadow: battleResult.result === "VICTORY"
                ? "0 30px 80px var(--bg-primary), 0 0 60px color-mix(in srgb, var(--ember) 27%, transparent), inset 0 0 60px color-mix(in srgb, var(--accent-primary) 13%, transparent)"
                : "0 30px 80px var(--bg-primary), 0 0 40px color-mix(in srgb, #b82b24 20%, transparent)",
              animation: "matchPop 380ms cubic-bezier(.2,1.2,.3,1)",
            }}
          >
            {/* Particulas de vitoria */}
            {battleResult.result === "VICTORY" && (
              <>
                {Array.from({ length: 14 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute bottom-0 rounded-full"
                    style={{
                      left: `${(i / 14) * 100}%`,
                      width: 2,
                      height: 2,
                      background: "var(--gold)",
                      boxShadow: "0 0 6px var(--gold)",
                      animation: `victoryParticle ${2 + (i % 3)}s ${i * 0.15}s ease-out infinite`,
                    }}
                  />
                ))}
              </>
            )}

            {/* Eyebrow */}
            <div
              className="mb-[10px] text-[10px] uppercase tracking-[0.4em]"
              style={{
                fontFamily: "var(--font-jetbrains)",
                color: battleResult.result === "VICTORY" ? "var(--gold)" : "#d96a52",
              }}
            >
              {battleResult.result === "VICTORY" ? "\u2726  combate encerrado  \u2726" : "combate encerrado"}
            </div>

            {/* Titulo */}
            <h2
              className="text-[64px] font-medium leading-none"
              style={{
                fontFamily: "var(--font-cormorant)",
                color: battleResult.result === "VICTORY" ? "white" : "#ff8a70",
                textShadow: battleResult.result === "VICTORY"
                  ? "0 0 20px var(--ember), 0 4px 12px var(--bg-primary)"
                  : "0 0 12px color-mix(in srgb, #b82b24 53%, transparent)",
              }}
            >
              {battleResult.result === "VICTORY" ? "Vitoria" : "Derrota"}
            </h2>

            {/* Bloco de vitoria */}
            {battleResult.result === "VICTORY" && (
              <div>
                <p
                  className="mb-6 mt-3 text-[14px] italic"
                  style={{
                    fontFamily: "var(--font-garamond)",
                    color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  }}
                >
                  A Forja registra seu feito.
                </p>

                {/* Card de XP */}
                <div
                  className="mb-6 flex items-center justify-between p-[14px]"
                  style={{
                    background: "color-mix(in srgb, var(--bg-primary) 67%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--gold) 20%, transparent)",
                  }}
                >
                  <span
                    className="text-[10px] uppercase tracking-[0.3em]"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                    }}
                  >
                    XP conquistado
                  </span>
                  <span
                    className="text-[28px] font-medium"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      color: "var(--ember)",
                    }}
                  >
                    +{battleResult.expGained}
                  </span>
                </div>

                {/* Level up */}
                {battleResult.levelsGained > 0 && (
                  <div
                    className="flex items-center justify-between p-[10px]"
                    style={{
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 20%, transparent), color-mix(in srgb, var(--ember) 20%, transparent))",
                      border: "1px solid var(--ember)",
                      animation: "levelUpPulse 2s ease-in-out infinite",
                    }}
                  >
                    <div className="text-left">
                      <div
                        className="text-[9px] uppercase tracking-[0.35em]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--ember)",
                        }}
                      >
                        Evolucao {"\u2B06"}
                      </div>
                      <div
                        className="text-[18px]"
                        style={{
                          fontFamily: "var(--font-cormorant)",
                          color: "white",
                        }}
                      >
                        Nivel {battleResult.newLevel - battleResult.levelsGained} {"\u2192"} {battleResult.newLevel}
                      </div>
                    </div>
                    <span
                      className="tracking-[0.15em]"
                      style={{
                        fontFamily: "var(--font-jetbrains)",
                        fontSize: 11,
                        color: "var(--ember)",
                      }}
                    >
                      +{battleResult.levelsGained * 5} livres
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bloco de derrota */}
            {battleResult.result === "DEFEAT" && (
              <p
                className="mt-[14px] mb-[30px] text-[15px] italic"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 67%, transparent)",
                  lineHeight: 1.4,
                }}
              >
                {"\u00AB"} A derrota e apenas o preco do aprendizado. {"\u00BB"}
              </p>
            )}

            {/* Botoes */}
            <div className={`flex flex-col gap-2 ${battleResult.result === "VICTORY" ? "mt-8" : "mt-0"}`}>
              <button
                type="button"
                onClick={handlePlayAgain}
                className="w-full cursor-pointer py-[13px] text-[11px] uppercase tracking-[0.35em] text-white transition-transform duration-150 hover:-translate-y-px"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  background: battleResult.result === "VICTORY"
                    ? "linear-gradient(135deg, var(--accent-primary), var(--ember))"
                    : "linear-gradient(135deg, #4a0f08, #b82b24)",
                  border: battleResult.result === "VICTORY"
                    ? "1px solid var(--ember)"
                    : "1px solid #b82b24",
                  boxShadow: battleResult.result === "VICTORY"
                    ? "0 0 20px color-mix(in srgb, var(--ember) 40%, transparent)"
                    : "none",
                }}
              >
                {battleResult.result === "VICTORY" ? "Jogar Novamente" : "Tentar Novamente"}
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full cursor-pointer py-[11px] text-[10px] uppercase tracking-[0.3em] transition-colors hover:text-white"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  background: "transparent",
                  border: "1px solid color-mix(in srgb, var(--gold) 27%, transparent)",
                }}
              >
                Voltar ao Salao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card drop reveal — sobre o resultado quando houve drop */}
      {showCardReveal && cardDropped && (
        <CardDropReveal
          card={cardDropped}
          onContinue={() => setShowCardReveal(false)}
        />
      )}
    </div>
  );
}
