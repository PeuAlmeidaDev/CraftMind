"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePvpTeamQueue } from "../_hooks/usePvpTeamQueue";

const INVITE_TIMEOUT_SECONDS = 30;

export default function PvpTeamInviteNotification() {
  const { pendingInvite, acceptInvite, declineInvite } = usePvpTeamQueue();

  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(INVITE_TIMEOUT_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    setTimeLeft(INVITE_TIMEOUT_SECONDS);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  // When pendingInvite changes, show/hide notification
  useEffect(() => {
    if (pendingInvite) {
      setVisible(true);
      startTimer();
    } else {
      setVisible(false);
      clearTimer();
    }
  }, [pendingInvite, startTimer, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const handleAccept = () => {
    if (!pendingInvite) return;
    acceptInvite(pendingInvite.inviteId);
    clearTimer();
  };

  const handleDecline = () => {
    if (!pendingInvite) return;
    declineInvite(pendingInvite.inviteId);
    clearTimer();
  };

  if (!pendingInvite) return null;

  const progressPercent = (timeLeft / INVITE_TIMEOUT_SECONDS) * 100;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-[var(--accent-primary)]/50 bg-[var(--bg-card)] shadow-2xl shadow-[var(--accent-primary)]/10 transition-transform duration-300 ease-out ${
        visible ? "translate-x-0" : "translate-x-[120%]"
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] rounded-full px-2 py-0.5 border border-[var(--accent-primary)]/50 text-[var(--accent-primary)] animate-pulse font-medium">
            CONVITE PVP TEAM
          </span>
          <span className="text-[10px] rounded-full px-2 py-0.5 border border-purple-500/50 text-purple-400 font-medium">
            2v2
          </span>
        </div>

        <p className="text-white font-semibold text-sm mt-2">
          {pendingInvite.senderName}
        </p>
        <p className="text-gray-400 text-xs">
          convidou voce para PvP Team 2v2
        </p>
      </div>

      {/* Timer */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Expira em</span>
          <span
            className={`font-medium ${timeLeft <= 10 ? "text-red-400" : "text-gray-300"}`}
          >
            {timeLeft}s
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-[var(--bg-primary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={handleDecline}
          className="flex-1 rounded-lg py-2 text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={handleAccept}
          className="flex-1 rounded-lg py-2 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 hover:brightness-110 transition cursor-pointer"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
