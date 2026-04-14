"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { expToNextLevel } from "@/lib/exp/formulas";
import { getHouseAssets } from "@/lib/houses/house-assets";
import { getToken } from "@/lib/client-auth";
import type { Character } from "@/types/character";
import type { HouseName } from "@/types/house";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

type Props = {
  profile: {
    name: string;
    avatarUrl: string | null;
    house: { name: string; animal: string } | null;
  };
  character: Character;
  onAvatarChange: (newUrl: string) => void;
};

export default function CharacterHeader({
  profile,
  character,
  onAvatarChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const expNeeded = expToNextLevel(character.level);
  const expPercent = Math.min(
    100,
    (character.currentExp / expNeeded) * 100
  );

  const houseAssets = profile.house
    ? getHouseAssets(profile.house.name as HouseName)
    : null;

  const initial = profile.name.charAt(0).toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError("Formato invalido. Use JPEG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Imagem muito grande. Maximo 2 MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const token = getToken() ?? "";

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        setUploadError("Falha ao enviar imagem. Tente novamente.");
        return;
      }

      const json = (await res.json()) as { data: { avatarUrl: string } };
      onAvatarChange(json.data.avatarUrl);
    } catch {
      setUploadError("Erro de conexao. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] p-5" style={{ background: `linear-gradient(135deg, var(--bg-card), var(--bg-primary))` }}>
      {houseAssets && (
        <Image
          src={houseAssets.bandeira}
          alt=""
          width={120}
          height={200}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.06]"
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex items-center gap-5">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          aria-label="Alterar avatar"
        >
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`Avatar de ${profile.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--accent-primary)]/20 text-xl font-bold text-[var(--accent-primary)]">
              {initial}
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <svg
                className="h-6 w-6 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1.5">
          {/* Nome + Casa */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {profile.name}
            </span>

            {profile.house && (
              <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-[var(--accent-primary)]" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                {HOUSE_DISPLAY[profile.house.name] ?? profile.house.name}
              </span>
            )}
          </div>

          {/* Level + EXP */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-sm font-bold text-white">
              {character.level}
            </div>

            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${expPercent}%` }}
                />
              </div>
              <span className="text-xs text-white/50">
                {character.currentExp} / {expNeeded} EXP
              </span>
            </div>
          </div>

          {/* Pontos livres */}
          {character.freePoints > 0 && (
            <span className="inline-flex w-fit rounded-md bg-[var(--accent-primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
              {character.freePoints} pontos livres
            </span>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="mt-2 text-xs text-red-400">{uploadError}</p>
      )}
    </div>
  );
}
