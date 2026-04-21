"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CoopPveProvider, useCoopPveQueue } from "../_hooks/useCoopPveQueue";
import type { SanitizedMobState, SanitizedCoopPveState, CoopPveMode } from "../_hooks/useCoopPveQueue";
import { getToken, authFetchOptions } from "@/lib/client-auth";
import CoopPveArena from "./_components/CoopPveArena";
import CoopPveResult from "./_components/CoopPveResult";
import InviteFriendModal from "./_components/InviteFriendModal";

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
  const ctx = useCoopPveQueue();
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");

  // Fetch player profile on mount (same pattern as boss-fight)
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
        }
      })
      .catch(() => {
        // Silently fail — profile not critical for phase rendering
      });

    return () => ac.abort();
  }, []);

  switch (ctx.phase) {
    case "IDLE":
      return <IdlePhase />;
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

function IdlePhase() {
  const { mode, setMode, joinQueue, sendInvite, invitePhase, inviteTargetName } = useCoopPveQueue();
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInvite = (targetUserId: string, targetName: string) => {
    sendInvite(targetUserId, targetName);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Coop PvE</h1>
        <p className="text-sm text-gray-400 mb-6">
          Junte-se a outro jogador para enfrentar mobs em dupla
        </p>

        {/* Mode selector */}
        <div className="flex justify-center gap-2 mb-6">
          <ModeButton current={mode} value="2v3" label="2v3" onSelect={setMode} />
          <ModeButton current={mode} value="2v5" label="2v5" onSelect={setMode} />
        </div>

        <p className="text-xs text-gray-500 mb-6">
          {mode === "2v3"
            ? "Voce e um parceiro enfrentam 3 mobs. Partida rapida."
            : "Voce e um parceiro enfrentam 5 mobs. Desafio maior, mais EXP."}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={joinQueue}
            className="w-full rounded-lg py-3 font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 hover:brightness-110 transition cursor-pointer"
          >
            Buscar Parceiro
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="w-full rounded-lg py-3 font-semibold text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/10 transition cursor-pointer"
          >
            Convidar Amigo
          </button>

          <button
            type="button"
            onClick={() => router.push("/battle")}
            className="w-full rounded-lg py-2 text-sm text-gray-400 hover:text-white transition cursor-pointer"
          >
            Voltar
          </button>
        </div>
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

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 bg-[var(--bg-card)] border border-[var(--accent-primary)]/50 rounded-xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-1">Parceiro encontrado!</h2>
        <p className="text-sm text-gray-400 mb-4">Modo {mode}</p>

        {/* Teammate info */}
        {matchTeammate && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <p className="text-sm text-gray-400">Seu parceiro:</p>
            <p className="text-white font-semibold">{matchTeammate.name}</p>
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
                  className="px-2 py-1 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-gray-300"
                >
                  {mob.name} (T{mob.tier})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accept counter */}
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
            className="flex-1 rounded-lg py-3 font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepted}
            className={`flex-1 rounded-lg py-3 font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
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
