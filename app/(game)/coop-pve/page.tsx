"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CoopPveProvider, useCoopPveQueue } from "../_hooks/useCoopPveQueue";
import type { SanitizedMobState, SanitizedCoopPveState, CoopPveMode } from "../_hooks/useCoopPveQueue";
import { getToken, authFetchOptions, clearAuthAndRedirect } from "@/lib/client-auth";
import CoopPveArena from "./_components/CoopPveArena";
import CoopPveResult from "./_components/CoopPveResult";
import InviteFriendModal from "./_components/InviteFriendModal";
import EmberField from "@/components/ui/EmberField";
import { HOUSE_LORE } from "@/lib/constants-house";

// ---------------------------------------------------------------------------
// Re-exported types for child components (part 2)
// ---------------------------------------------------------------------------

export type { SanitizedMobState, SanitizedCoopPveState };

export type CoopPveSkillInfo = {
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

export type CoopPveTeammateInfo = {
  playerId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: Array<{ status: string; remainingTurns: number }>;
  isAlive: boolean;
  avatarUrl: string | null;
  houseName: string;
};

export type CoopPveMobInfo = {
  playerId: string;
  name: string;
  tier: number;
  hp: number;
  maxHp: number;
  defeated: boolean;
  statusEffects: Array<{ status: string; remainingTurns: number }>;
  index: number;
  imageUrl: string | null;
};

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function CoopPvePage() {
  return (
    <Suspense fallback={<CoopPveLoading />}>
      <CoopPveContent />
    </Suspense>
  );
}

function CoopPveLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="mt-3 text-sm text-gray-400">Carregando...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content with provider
// ---------------------------------------------------------------------------

function CoopPveContent() {
  return (
    <CoopPveProvider>
      <CoopPveInner />
    </CoopPveProvider>
  );
}

// ---------------------------------------------------------------------------
// Inner — phase-based rendering
// ---------------------------------------------------------------------------

function CoopPveInner() {
  const router = useRouter();
  const ctx = useCoopPveQueue();
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [profile, setProfile] = useState<{ name: string; avatarUrl: string | null; house: { name: string } | null } | null>(null);
  const [activeBattleType, setActiveBattleType] = useState<string | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Fetch player profile on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const ac = new AbortController();

    fetch("/api/user/profile", authFetchOptions(token, ac.signal))
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{
          data: { id: string; name: string; avatarUrl: string | null; house: { name: string } | null };
        }>;
      })
      .then((json) => {
        if (json) {
          setCurrentPlayerId(json.data.id);
          setProfile({ name: json.data.name, avatarUrl: json.data.avatarUrl, house: json.data.house });
        }
      })
      .catch(() => {});

    return () => ac.abort();
  }, []);

  // Check for active battle on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();

    const checkActiveBattle = async () => {
      try {
        const res = await fetch("/api/battle/active", authFetchOptions(token, ac.signal));

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          setCheckingActive(false);
          return;
        }

        const json = (await res.json()) as {
          data:
            | { hasBattle: true; battleType: string; battleId: string }
            | { hasBattle: false };
        };

        if (json.data.hasBattle) {
          setActiveBattleType(json.data.battleType);
        }
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

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const socket = await ctx.reconnectSocket();
      socket.emit("coop-pve:battle:request-state");
      // Wait for the hook listener to process battle:state and set phase to BATTLE
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setActiveBattleType(null);
    } catch {
      setActiveBattleType(null);
    } finally {
      setReconnecting(false);
    }
  };

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

  // Show reconnect banner if active battle detected and phase is still IDLE
  if (activeBattleType && ctx.phase === "IDLE") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="max-w-sm w-full rounded-xl border border-amber-500/30 p-8 text-center"
          style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}
        >
          <div className="text-5xl mb-4">&#9876;&#65039;</div>
          <h2 className="text-lg font-bold text-white mb-2">Batalha em andamento</h2>
          <p className="text-sm text-gray-400 mb-6">
            Voce tem uma batalha {activeBattleType === "coop-pve" ? "Coop PvE" : activeBattleType} ativa. Deseja reconectar?
          </p>
          <button
            type="button"
            onClick={handleReconnect}
            disabled={reconnecting}
            className={`w-full cursor-pointer rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 transition ${
              reconnecting ? "opacity-60 cursor-not-allowed" : "hover:brightness-110"
            }`}
          >
            {reconnecting ? "Reconectando..." : "Reconectar"}
          </button>
          <button
            type="button"
            onClick={() => setActiveBattleType(null)}
            className="mt-3 w-full cursor-pointer rounded-lg py-3 text-gray-400 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:text-white transition"
          >
            Ignorar
          </button>
        </div>
      </div>
    );
  }

  switch (ctx.phase) {
    case "IDLE":
      return <IdlePhase profile={profile} />;
    case "QUEUE":
      return <QueuePhase />;
    case "MATCH":
      return <MatchPhase />;
    case "BATTLE":
      return <BattlePhase currentPlayerId={currentPlayerId} />;
    case "RESULT":
      return <ResultPhase />;
  }
}

// ---------------------------------------------------------------------------
// IDLE — Mode selector + join button
// ---------------------------------------------------------------------------

function IdlePhase({ profile }: { profile: { name: string; avatarUrl: string | null; house: { name: string } | null } | null }) {
  const { mode, setMode, joinQueue, sendInvite, invitePhase, inviteTargetName } = useCoopPveQueue();
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInvite = (targetUserId: string, targetName: string) => {
    sendInvite(targetUserId, targetName);
  };

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
            {mode === "3v5" ? "Coop · 3 Jogadores" : "Coop · 2 Jogadores"}
          </div>
          <h1
            className="text-[clamp(32px,5vw,48px)] font-medium text-white"
            style={{ fontFamily: "var(--font-cormorant)", lineHeight: 1 }}
          >
            {mode === "3v5" ? "Forme seu Esquadrao" : "Reuna seu Aliado"}
          </h1>
          <p
            className="mx-auto mt-2 max-w-md text-[15px] italic"
            style={{ fontFamily: "var(--font-garamond)", color: "color-mix(in srgb, var(--gold) 67%, transparent)" }}
          >
            {mode === "3v5"
              ? <>&laquo; Tres lâminas ferem mais fundo que uma. &raquo;</>
              : <>&laquo; Juntos, a jornada e mais leve e o destino mais certo. &raquo;</>}
          </p>
        </div>

        {/* Card de selecao */}
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
            &#9873;
          </div>

          {/* Formation visual */}
          <div
            className="mx-auto mb-5 grid max-w-[220px] items-center gap-2"
            style={{
              gridTemplateColumns: "1fr auto 1fr",
              padding: "12px 8px",
              background: "linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--ember) 4%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
            }}
          >
            {/* Aliados */}
            <div className="flex justify-end gap-1">
              {Array.from({ length: mode === "3v5" ? 3 : 2 }).map((_, i) => (
                <span
                  key={i}
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 40% 35%, var(--ember), color-mix(in srgb, var(--ember) 20%, transparent))",
                    border: "1px solid var(--ember)",
                    boxShadow: "0 0 4px color-mix(in srgb, var(--ember) 27%, transparent)",
                  }}
                />
              ))}
            </div>
            <span
              className="text-[11px] tracking-[0.15em]"
              style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 53%, transparent)" }}
            >
              ·vs·
            </span>
            {/* Inimigos */}
            <div className="flex gap-1">
              {Array.from({ length: mode === "2v3" ? 3 : 5 }).map((_, i) => (
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
            {(["2v3", "2v5", "3v5"] as const).map((m) => {
              const active = mode === m;
              const subtitle = m === "2v3" ? "Rapido" : m === "2v5" ? "Desafio" : "Esquadrao";
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
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
                  <span>{m}</span>
                  <span
                    className="text-[10px] normal-case tracking-normal"
                    style={{
                      fontFamily: "var(--font-garamond)",
                      fontStyle: "italic",
                      letterSpacing: 0,
                      color: active ? "var(--ember)" : "color-mix(in srgb, var(--gold) 47%, transparent)",
                    }}
                  >
                    {subtitle}
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
            {mode === "2v3"
              ? "Junte-se a um aliado contra 3 mobs — partida rapida"
              : mode === "2v5"
              ? "Junte-se a um aliado contra 5 mobs — desafio maior, mais EXP"
              : "3 jogadores vs 5 mobs — EXP dividido entre 3. Mobs mais fortes."}
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
            {mode === "2v3" ? "EXP x2 bonus" : mode === "2v5" ? "EXP x3 bonus" : "EXP x2 bonus (÷3)"}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={joinQueue}
              className="w-full cursor-pointer py-3 text-[11px] uppercase tracking-[0.3em] text-white transition-transform duration-150 hover:-translate-y-px"
              style={{
                fontFamily: "var(--font-cinzel)",
                background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--ember) 100%)",
                border: "1px solid var(--ember)",
                boxShadow: "0 0 12px color-mix(in srgb, var(--ember) 20%, transparent)",
              }}
            >
              {mode === "3v5" ? "Buscar Esquadrao" : "Buscar Parceiro"}
            </button>

            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="w-full cursor-pointer py-3 text-[11px] uppercase tracking-[0.3em] transition-all duration-150 hover:brightness-125"
              style={{
                fontFamily: "var(--font-cinzel)",
                background: "transparent",
                border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                color: "var(--gold)",
              }}
            >
              Convidar Amigo
            </button>
          </div>
        </article>

        {/* Voltar */}
        <button
          type="button"
          onClick={() => router.push("/battle")}
          className="cursor-pointer border-0 bg-transparent text-[13px] italic transition-colors hover:text-white"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 67%, transparent)",
            textDecoration: "underline",
            textDecorationColor: "color-mix(in srgb, var(--gold) 27%, transparent)",
            textUnderlineOffset: "3px",
          }}
        >
          Voltar
        </button>

        {/* Footer motto */}
        <footer
          className="text-center text-xs italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 40%, transparent)",
          }}
        >
          &laquo; {profile?.house?.name && HOUSE_LORE[profile.house.name]
            ? HOUSE_LORE[profile.house.name].motto
            : "Juntos, a jornada e mais leve e o destino mais certo"} &raquo;
        </footer>
      </div>

      {showInviteModal && (
        <InviteFriendModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          mode={mode}
          onInvite={handleInvite}
          invitePhase={invitePhase}
          inviteTargetName={inviteTargetName}
        />
      )}
    </div>
  );
}

function ModeButton({
  current,
  value,
  label,
  onSelect,
}: {
  current: CoopPveMode;
  value: CoopPveMode;
  label: string;
  onSelect: (m: CoopPveMode) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`px-6 py-2 rounded-lg font-semibold text-sm transition cursor-pointer ${
        active
          ? "bg-[var(--accent-primary)] text-white"
          : "bg-[var(--bg-primary)] text-gray-400 border border-[var(--border-subtle)] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// QUEUE — Searching for partner
// ---------------------------------------------------------------------------

function QueuePhase() {
  const { queuePosition, queueSize, queueTimeRemaining, leaveQueue, mode } = useCoopPveQueue();

  const minutes = Math.floor(queueTimeRemaining / 60);
  const seconds = queueTimeRemaining % 60;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
        <div className="w-10 h-10 mx-auto border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />

        <h2 className="text-xl font-bold text-white mb-2">Buscando parceiro...</h2>
        <p className="text-sm text-gray-400 mb-4">Modo {mode}</p>

        <div className="space-y-2 text-sm text-gray-400 mb-6">
          <p>Posicao na fila: <span className="text-white font-medium">{queuePosition}</span> / {queueSize}</p>
          <p>Tempo restante: <span className="text-white font-medium">{minutes}:{seconds.toString().padStart(2, "0")}</span></p>
        </div>

        <button
          type="button"
          onClick={leaveQueue}
          className="w-full rounded-lg py-2 text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
        >
          Cancelar busca
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MATCH — Partner found, accept/decline
// ---------------------------------------------------------------------------

function MatchPhase() {
  const {
    matchTeammate,
    matchTeammates,
    matchMobs,
    matchAcceptTimeout,
    matchAcceptedCount,
    matchExpectedCount,
    acceptMatch,
    declineMatch,
    mode,
  } = useCoopPveQueue();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
    acceptMatch();
  };

  // Use teammates array; fallback to singular teammate for backward compat
  const allTeammates = matchTeammates.length > 0 ? matchTeammates : (matchTeammate ? [matchTeammate] : []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--accent-primary)]/50 rounded-xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-1">
          {mode === "3v5" ? "Esquadrao formado!" : "Parceiro encontrado!"}
        </h2>
        <p className="text-sm text-gray-400 mb-4">Modo {mode}</p>

        {/* Teammates info */}
        {allTeammates.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-400">
              {allTeammates.length === 1 ? "Seu parceiro:" : "Seus aliados:"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {allTeammates.map((tm) => (
                <div
                  key={tm.userId}
                  className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                >
                  <p className="text-white font-semibold text-sm">{tm.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobs */}
        {matchMobs.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Oponentes:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {matchMobs.map((mob, i) => (
                <span
                  key={`${mob.name}-${i}`}
                  className="px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-gray-300"
                >
                  {mob.name} (T{mob.tier})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accept counter with squad slots */}
        <div className="mb-3 flex justify-center gap-1.5">
          {Array.from({ length: matchExpectedCount }).map((_, i) => (
            <div
              key={i}
              className="flex h-6 w-6 items-center justify-center border text-[10px] font-bold"
              style={{
                borderColor: i < matchAcceptedCount ? "var(--ember)" : "color-mix(in srgb, var(--gold) 30%, transparent)",
                background: i < matchAcceptedCount ? "color-mix(in srgb, var(--ember) 20%, transparent)" : "transparent",
                color: i < matchAcceptedCount ? "var(--ember)" : "color-mix(in srgb, var(--gold) 40%, transparent)",
              }}
            >
              {i < matchAcceptedCount ? "\u2713" : "\u2022"}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Aceitos: {matchAcceptedCount}/{matchExpectedCount}
        </p>

        {/* Timer */}
        <p className="text-sm text-yellow-400 font-medium mb-4">
          {matchAcceptTimeout}s para aceitar
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={declineMatch}
            disabled={accepted}
            className="flex-1 py-3 font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepted}
            className={`flex-1 py-3 font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
              accepted
                ? "bg-emerald-800/50 text-emerald-300 border border-emerald-500/30"
                : "text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:brightness-110"
            }`}
          >
            {accepted ? "Aceito!" : "Aceitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BATTLE
// ---------------------------------------------------------------------------

function BattlePhase({ currentPlayerId }: { currentPlayerId: string }) {
  const { battleState, turnTimeRemaining, actedPlayers, turnEvents, sendAction, requestState } = useCoopPveQueue();
  const hasRequestedState = useRef(false);

  // Sinalizar ao server que o player carregou a tela de batalha
  useEffect(() => {
    if (!hasRequestedState.current) {
      hasRequestedState.current = true;
      requestState();
    }
  }, [requestState]);

  if (!battleState) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-gray-400">Carregando estado da batalha...</p>
      </div>
    );
  }

  return (
    <CoopPveArena
      battleState={battleState}
      currentPlayerId={currentPlayerId}
      turnTimeRemaining={turnTimeRemaining}
      actedPlayers={actedPlayers}
      turnEvents={turnEvents}
      onAction={sendAction}
    />
  );
}

// ---------------------------------------------------------------------------
// RESULT
// ---------------------------------------------------------------------------

function ResultPhase() {
  const { result, expGained, levelsGained, newLevel, playAgain } = useCoopPveQueue();
  const router = useRouter();

  if (!result) return null;

  return (
    <CoopPveResult
      result={result}
      expGained={expGained}
      levelsGained={levelsGained}
      newLevel={newLevel}
      onPlayAgain={playAgain}
      onGoHome={() => router.push("/dashboard")}
    />
  );
}
