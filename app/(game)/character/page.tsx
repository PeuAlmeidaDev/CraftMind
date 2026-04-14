"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  clearAuthAndRedirect,
  authFetchOptions,
} from "@/lib/client-auth";
import type { Character } from "@/types/character";
import type { CharacterSkillSlot } from "@/types/skill";
import CharacterHeader from "./_components/CharacterHeader";
import AttributePanel from "./_components/AttributePanel";
import SkillLoadout from "./_components/SkillLoadout";
import SkillSelectModal from "./_components/SkillSelectModal";
import SkillInventory from "./_components/SkillInventory";
import HouseBanner from "./_components/HouseBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  name: string;
  avatarUrl: string | null;
  house: { name: string; animal: string; description: string } | null;
};

// ---------------------------------------------------------------------------
// Pagina do personagem
// ---------------------------------------------------------------------------

export default function CharacterPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [equippedSkills, setEquippedSkills] = useState<CharacterSkillSlot[]>([]);
  const [unequippedSkills, setUnequippedSkills] = useState<CharacterSkillSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  /** Guarda se uma acao de equip/unequip esta em andamento */
  const skillActionRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      const token = getToken();
      if (!token) {
        clearAuthAndRedirect(router);
        return;
      }

      const opts = authFetchOptions(token, controller.signal);

      try {
        const [profileRes, characterRes, skillsRes] = await Promise.all([
          fetch("/api/user/profile", opts),
          fetch("/api/character", opts),
          fetch("/api/character/skills", opts),
        ]);

        if (
          profileRes.status === 401 ||
          characterRes.status === 401 ||
          skillsRes.status === 401
        ) {
          clearAuthAndRedirect(router);
          return;
        }

        if (profileRes.ok) {
          const profileJson = (await profileRes.json()) as {
            data: UserProfile;
          };
          setProfile(profileJson.data);
        }

        if (characterRes.ok) {
          const charJson = (await characterRes.json()) as {
            data: { character: Character; skills: CharacterSkillSlot[] };
          };
          setCharacter(charJson.data.character);
        }

        if (skillsRes.ok) {
          const skillsJson = (await skillsRes.json()) as {
            data: { equipped: CharacterSkillSlot[]; unequipped: CharacterSkillSlot[] };
          };
          setEquippedSkills(skillsJson.data.equipped);
          setUnequippedSkills(skillsJson.data.unequipped);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    return () => controller.abort();
  }, [router]);

  function handleAvatarChange(newUrl: string) {
    setProfile((prev) => (prev ? { ...prev, avatarUrl: newUrl } : prev));
  }

  function handleDistribute(updatedCharacter: Character) {
    setCharacter(updatedCharacter);
  }

  function handleSlotClick(slotIndex: number) {
    setSelectedSlot(slotIndex);
  }

  const refetchSkills = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch("/api/character/skills", authFetchOptions(token));
    if (res.ok) {
      const json = (await res.json()) as {
        data: { equipped: CharacterSkillSlot[]; unequipped: CharacterSkillSlot[] };
      };
      setEquippedSkills(json.data.equipped);
      setUnequippedSkills(json.data.unequipped);
    }
  }, []);

  async function handleUnequip(slotIndex: number) {
    if (skillActionRef.current) return;
    const token = getToken();
    if (!token) return;
    skillActionRef.current = true;
    try {
      const res = await fetch("/api/character/skills/unequip", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ slotIndex }),
      });
      if (res.ok) await refetchSkills();
    } finally {
      skillActionRef.current = false;
    }
  }

  async function handleEquip(skillId: string, slotIndex: number) {
    if (skillActionRef.current) return;
    const token = getToken();
    if (!token) return;
    skillActionRef.current = true;
    try {
      const res = await fetch("/api/character/skills/equip", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ skillId, slotIndex }),
      });
      if (res.ok) {
        await refetchSkills();
        setSelectedSlot(null);
      }
    } finally {
      skillActionRef.current = false;
    }
  }

  const allSkills = [...equippedSkills, ...unequippedSkills];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="h-80 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
          <div className="h-96 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do personagem */}
      {profile && character && (
        <CharacterHeader
          profile={profile}
          character={character}
          onAvatarChange={handleAvatarChange}
        />
      )}

      {/* Grid: atributos (esquerda) + skills (direita) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Coluna esquerda */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {character && (
            <AttributePanel
              character={character}
              onDistribute={handleDistribute}
            />
          )}
          {profile?.house && (
            <HouseBanner houseName={profile.house.name} />
          )}
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          <SkillLoadout
            equipped={equippedSkills}
            onSlotClick={handleSlotClick}
            onUnequip={handleUnequip}
          />
          <SkillInventory skills={allSkills} />
        </div>
      </div>

      {/* Modal de selecao de skill */}
      <SkillSelectModal
        open={selectedSlot !== null}
        slotIndex={selectedSlot ?? 0}
        allSkills={allSkills}
        onSelect={handleEquip}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
