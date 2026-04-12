"use client";

import { useRef, useEffect, useCallback, useState } from "react";

const AMBIENT_TRACKS = [
  "/music/ambient/Forest of Early Quests.mp3",
  "/music/ambient/Instrumental.mp3",
  "/music/ambient/Whispers of the Willow Path 1.mp3",
  "/music/ambient/Whispers of the Willow Path 2.mp3",
  "/music/ambient/Willowlight Lullaby.mp3",
];

const BATTLE_TRACKS = [
  "/music/battle/Blade of the Last Dawn 1.mp3",
  "/music/battle/Blade of the Last Dawn 2.mp3",
];

type MusicContext = "ambient" | "battle";

const TARGET_VOLUME: Record<MusicContext, number> = {
  ambient: 0.15,
  battle: 0.20,
};

function getTracksForContext(context: MusicContext): string[] {
  return context === "battle" ? BATTLE_TRACKS : AMBIENT_TRACKS;
}

function pickRandomTrack(tracks: string[], exclude?: string): string {
  if (tracks.length === 1) return tracks[0];
  const candidates = exclude ? tracks.filter((t) => t !== exclude) : tracks;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const FADE_INTERVAL_MS = 50;
const FADE_STEP = 0.02;

export type MusicControls = {
  muted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
};

export function useMusicPlayer(context: MusicContext): MusicControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextRef = useRef<MusicContext>(context);
  const currentTrackRef = useRef<string>("");
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const mutedRef = useRef(false);
  const userVolumeRef = useRef<number | null>(null);

  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(TARGET_VOLUME[context]);

  const clearFadeInterval = useCallback(() => {
    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  const safePlay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      const promise = audio.play();
      playPromiseRef.current = promise;
      await promise;
    } catch {
      // Browser blocked autoplay or play was interrupted — fail silently
    } finally {
      playPromiseRef.current = null;
    }
  }, []);

  const safePause = useCallback(async (audio: HTMLAudioElement) => {
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {
        // ignored
      }
    }
    audio.pause();
  }, []);

  const getTargetVolume = useCallback((ctx: MusicContext) => {
    return userVolumeRef.current ?? TARGET_VOLUME[ctx];
  }, []);

  const fadeIn = useCallback(
    (targetVolume: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      clearFadeInterval();

      if (mutedRef.current) {
        audio.volume = 0;
        return;
      }

      audio.volume = 0;
      fadeIntervalRef.current = setInterval(() => {
        if (!audioRef.current) { clearFadeInterval(); return; }
        const next = Math.min(audioRef.current.volume + FADE_STEP, targetVolume);
        audioRef.current.volume = next;
        if (next >= targetVolume) clearFadeInterval();
      }, FADE_INTERVAL_MS);
    },
    [clearFadeInterval],
  );

  const fadeOutAndSwitch = useCallback(
    (newContext: MusicContext) => {
      const audio = audioRef.current;
      if (!audio) return;
      clearFadeInterval();

      fadeIntervalRef.current = setInterval(async () => {
        if (!audioRef.current) { clearFadeInterval(); return; }

        const next = Math.max(audioRef.current.volume - FADE_STEP, 0);
        audioRef.current.volume = next;

        if (next <= 0) {
          clearFadeInterval();
          await safePause(audioRef.current);

          const tracks = getTracksForContext(newContext);
          const track = pickRandomTrack(tracks);
          currentTrackRef.current = track;
          audioRef.current.src = track;

          const targetVol = getTargetVolume(newContext);
          fadeIn(targetVol);
          await safePlay(audioRef.current);
        }
      }, FADE_INTERVAL_MS);
    },
    [clearFadeInterval, fadeIn, safePlay, safePause, getTargetVolume],
  );

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleEnded = () => {
      const ctx = contextRef.current;
      const tracks = getTracksForContext(ctx);
      const track = pickRandomTrack(tracks, currentTrackRef.current);
      currentTrackRef.current = track;
      audio.src = track;
      safePlay(audio);
    };

    audio.addEventListener("ended", handleEnded);

    // Start playback
    const tracks = getTracksForContext(contextRef.current);
    const track = pickRandomTrack(tracks);
    currentTrackRef.current = track;
    audio.src = track;
    audio.volume = getTargetVolume(contextRef.current);
    setVolumeState(audio.volume);

    // Try autoplay — if blocked, retry on first user interaction
    const tryPlay = async () => {
      try {
        const promise = audio.play();
        playPromiseRef.current = promise;
        await promise;
        playPromiseRef.current = null;
        // Autoplay worked — remove listeners
        document.removeEventListener("click", resumeOnInteraction);
        document.removeEventListener("keydown", resumeOnInteraction);
        document.removeEventListener("touchstart", resumeOnInteraction);
      } catch {
        playPromiseRef.current = null;
        // Autoplay blocked — wait for user interaction
      }
    };

    const resumeOnInteraction = () => {
      if (audioRef.current && audioRef.current.paused) {
        safePlay(audioRef.current);
      }
      document.removeEventListener("click", resumeOnInteraction);
      document.removeEventListener("keydown", resumeOnInteraction);
      document.removeEventListener("touchstart", resumeOnInteraction);
    };

    document.addEventListener("click", resumeOnInteraction, { once: false });
    document.addEventListener("keydown", resumeOnInteraction, { once: false });
    document.addEventListener("touchstart", resumeOnInteraction, { once: false });

    tryPlay();

    return () => {
      document.removeEventListener("click", resumeOnInteraction);
      document.removeEventListener("keydown", resumeOnInteraction);
      document.removeEventListener("touchstart", resumeOnInteraction);
      audio.removeEventListener("ended", handleEnded);
      clearFadeInterval();
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [safePlay, clearFadeInterval, getTargetVolume]);

  // Handle context transitions
  useEffect(() => {
    if (contextRef.current === context) return;
    contextRef.current = context;
    fadeOutAndSwitch(context);
  }, [context, fadeOutAndSwitch]);

  // Controls
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setMuted(newMuted);

    if (newMuted) {
      audio.volume = 0;
    } else {
      audio.volume = getTargetVolume(contextRef.current);
    }
  }, [getTargetVolume]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    userVolumeRef.current = clamped;
    setVolumeState(clamped);

    const audio = audioRef.current;
    if (audio && !mutedRef.current) {
      audio.volume = clamped;
    }
  }, []);

  return { muted, volume, toggleMute, setVolume };
}
