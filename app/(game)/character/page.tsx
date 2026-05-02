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
import CardSlots from "./_components/CardSlots";
import type { UserCardSummary } from "./_components/CardSlots";
import CardPickerModal from "./_components/CardPickerModal";
import PendingDuplicatesModal from "./_components/PendingDuplicatesModal";
import SpectralSkillSelectModal from "./_components/SpectralSkillSelectModal";
import type { PendingCardDuplicateSummary } from "@/types/cards";
import EmberField from "@/components/ui/EmberField";
import { HOUSE_LORE } from "@/lib/constants-house";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  id: string;
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
  const [userCards, setUserCards] = useState<UserCardSummary[]>([]);
  const [pendingDuplicates, setPendingDuplicates] = useState<
    PendingCardDuplicateSummary[]
  >([]);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedCardSlot, setSelectedCardSlot] = useState<number | null>(null);
  /** UserCard.id atualmente sendo editado no SpectralSkillSelectModal. */
  const [spectralModalUserCardId, setSpectralModalUserCardId] = useState<
    string | null
  >(null);

  /** Guarda se uma acao de equip/unequip esta em andamento */
  const skillActionRef = useRef(false);
  /** Guarda se uma acao de equip/unequip de cristal esta em andamento */
  const cardActionRef = useRef(false);

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
        const [profileRes, characterRes, skillsRes, cardsRes, pendingRes] =
          await Promise.all([
            fetch("/api/user/profile", opts),
            fetch("/api/character", opts),
            fetch("/api/character/skills", opts),
            fetch("/api/cards", opts),
            fetch("/api/cards/pending-duplicates", opts),
          ]);

        if (
          profileRes.status === 401 ||
          characterRes.status === 401 ||
          skillsRes.status === 401 ||
          cardsRes.status === 401 ||
          pendingRes.status === 401
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

        if (cardsRes.ok) {
          const cardsJson = (await cardsRes.json()) as {
            data: { userCards: UserCardSummary[] };
          };
          setUserCards(cardsJson.data.userCards);
        }

        if (pendingRes.ok) {
          const pendingJson = (await pendingRes.json()) as {
            data: { pendingDuplicates: PendingCardDuplicateSummary[] };
          };
          setPendingDuplicates(pendingJson.data.pendingDuplicates);
          if (pendingJson.data.pendingDuplicates.length > 0) {
            setPendingModalOpen(true);
          }
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

  // -----------------------------------------------------------------------
  // Cristais equipados
  // -----------------------------------------------------------------------

  const refetchCards = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch("/api/cards", authFetchOptions(token));
    if (res.ok) {
      const json = (await res.json()) as {
        data: { userCards: UserCardSummary[] };
      };
      setUserCards(json.data.userCards);
    }
  }, []);

  const refetchCharacter = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch("/api/character", authFetchOptions(token));
    if (res.ok) {
      const json = (await res.json()) as {
        data: { character: Character; skills: CharacterSkillSlot[] };
      };
      setCharacter(json.data.character);
    }
  }, []);

  function handleCardSlotClick(slotIndex: number) {
    setSelectedCardSlot(slotIndex);
  }

  async function handleEquipCard(userCardId: string, slotIndex: number) {
    if (cardActionRef.current) return;
    const token = getToken();
    if (!token) return;
    cardActionRef.current = true;
    try {
      const res = await fetch("/api/cards/equip", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userCardId, slotIndex }),
      });
      if (res.ok) {
        // Procurar a UserCard recem-equipada no estado local pra checar se eh
        // Espectral sem skillId (nesse caso abrimos o modal automaticamente).
        const justEquipped = userCards.find((u) => u.id === userCardId);
        await Promise.all([refetchCards(), refetchCharacter()]);
        setSelectedCardSlot(null);
        if (
          justEquipped &&
          justEquipped.purity === 100 &&
          !justEquipped.spectralSkillId
        ) {
          setSpectralModalUserCardId(userCardId);
        }
      }
    } finally {
      cardActionRef.current = false;
    }
  }

  function handleSpectralSkillClick(userCardId: string) {
    setSpectralModalUserCardId(userCardId);
  }

  async function handleSpectralSaved(_spectralSkillId: string) {
    void _spectralSkillId;
    await refetchCards();
  }

  const refetchPendingDuplicates = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(
      "/api/cards/pending-duplicates",
      authFetchOptions(token),
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data: { pendingDuplicates: PendingCardDuplicateSummary[] };
      };
      setPendingDuplicates(json.data.pendingDuplicates);
    }
  }, []);

  const handlePendingResolved = useCallback(
    async (resolvedId: string) => {
      // Atualizacao otimista: remove do estado local imediatamente.
      setPendingDuplicates((prev) => prev.filter((p) => p.id !== resolvedId));
      // Refetch UserCards para refletir mudanca de purity/level/xp.
      await Promise.all([refetchCards(), refetchPendingDuplicates()]);
    },
    [refetchCards, refetchPendingDuplicates],
  );

  async function handleUnequipCard(slotIndex: number) {
    if (cardActionRef.current) return;
    const token = getToken();
    if (!token) return;
    cardActionRef.current = true;
    try {
      const res = await fetch("/api/cards/unequip", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ slotIndex }),
      });
      if (res.ok) await Promise.all([refetchCards(), refetchCharacter()]);
    } finally {
      cardActionRef.current = false;
    }
  }

  const allSkills = [...equippedSkills, ...unequippedSkills];

  const houseName = profile?.house?.name ?? null;

  if (loading) {
    return (
      <div className="relative">
        <EmberField />
        <div className="relative z-[2] flex flex-col gap-[18px]">
          <div
            className="h-32 animate-pulse"
            style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)" }}
          />
          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[320px_1fr]">
            <div
              className="h-80 animate-pulse"
              style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)" }}
            />
            <div
              className="h-96 animate-pulse"
              style={{ background: "color-mix(in srgb, var(--gold) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ember particles */}
      <EmberField />

      {/* Ambient backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 15% 8%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0, transparent 55%),
            radial-gradient(ellipse at 88% 92%, color-mix(in srgb, var(--deep) 40%, transparent) 0, transparent 55%)`,
        }}
      />

      <div className="relative z-[2] flex flex-col gap-[18px]">
        {/* Header do personagem */}
        {profile && character && (
          <CharacterHeader
            profile={profile}
            character={character}
            onAvatarChange={handleAvatarChange}
          />
        )}

        {/* Grid: atributos (esquerda) + skills (direita) */}
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[320px_1fr]">
          {/* Coluna esquerda */}
          <div className="flex flex-col gap-[18px] lg:sticky lg:top-20 lg:self-start">
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
          <div className="flex flex-col gap-[18px]">
            <SkillLoadout
              equipped={equippedSkills}
              onSlotClick={handleSlotClick}
              onUnequip={handleUnequip}
            />
            <CardSlots
              userCards={userCards}
              onSlotClick={handleCardSlotClick}
              onUnequip={handleUnequipCard}
              onSpectralSkillClick={handleSpectralSkillClick}
            />
            {profile?.id && (
              <div className="flex justify-end">
                <Link
                  href={`/character/${profile.id}/showcase`}
                  className="px-4 py-2 text-[10px] uppercase tracking-[0.25em] transition-colors"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "var(--gold)",
                    border:
                      "1px solid color-mix(in srgb, var(--gold) 35%, transparent)",
                    background:
                      "color-mix(in srgb, var(--gold) 6%, transparent)",
                  }}
                >
                  Vitrine de Cristais
                </Link>
              </div>
            )}
            <SkillInventory skills={allSkills} />
          </div>
        </div>

        {/* Footer motto */}
        <footer
          className="mt-2 text-center text-xs italic"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 40%, transparent)",
          }}
        >
          &laquo; {houseName && HOUSE_LORE[houseName]
            ? HOUSE_LORE[houseName].motto
            : "O conhecimento e a chave, a disciplina e o caminho"} &raquo;
        </footer>
      </div>

      {/* Modal de selecao de skill */}
      <SkillSelectModal
        open={selectedSlot !== null}
        slotIndex={selectedSlot ?? 0}
        allSkills={allSkills}
        onSelect={handleEquip}
        onClose={() => setSelectedSlot(null)}
      />

      {/* Modal de selecao de cristal */}
      <CardPickerModal
        open={selectedCardSlot !== null}
        slotIndex={selectedCardSlot ?? 0}
        userCards={userCards}
        onSelect={handleEquipCard}
        onClose={() => setSelectedCardSlot(null)}
      />

      {/* Modal de pendencias de duplicatas */}
      <PendingDuplicatesModal
        open={pendingModalOpen && pendingDuplicates.length > 0}
        pendings={pendingDuplicates}
        onResolved={handlePendingResolved}
        onClose={() => setPendingModalOpen(false)}
      />

      {/* Modal de skill espectral (5o slot em batalha) */}
      <SpectralSkillSelectModal
        open={spectralModalUserCardId !== null}
        userCardId={spectralModalUserCardId}
        currentSkillId={
          userCards.find((u) => u.id === spectralModalUserCardId)
            ?.spectralSkillId ?? null
        }
        onClose={() => setSpectralModalUserCardId(null)}
        onSaved={handleSpectralSaved}
      />
    </div>
  );
}
