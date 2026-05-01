import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import {
  hasActiveMultiBattle,
  setMultiPveBattle,
} from "@/lib/battle/pve-multi-store";
import { initMultiPveBattle } from "@/lib/battle/pve-multi-turn";
import { getPlayerTier, rollMobTier, selectRandomMob } from "@/lib/exp/matchmaking";
import { createPlayerState } from "@/lib/battle/shared-helpers";
import { loadEquippedCardsAndApply } from "@/lib/cards/load-equipped";
import {
  rollEncounterStars,
  applyStarMultiplier,
  type EncounterStars,
  type StatBlock,
} from "@/lib/mobs/encounter-stars";
import type { EquippedSkill, BaseStats } from "@/lib/battle/types";
import type { AiProfile } from "@/lib/battle/ai-profiles";
import type { MobState, PveMultiMode } from "@/lib/battle/pve-multi-types";
import type {
  Skill,
  SkillTarget,
  DamageType,
  SkillMastery,
} from "@/types/skill";

const startBodySchema = z.object({
  mode: z.enum(["1v3", "1v5"]).default("1v3"),
}).optional();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // Parse body para determinar modo (1v3 ou 1v5)
    let mode: PveMultiMode = "1v3";
    try {
      const rawBody: unknown = await request.json();
      const parsed = startBodySchema.safeParse(rawBody);
      if (parsed.success && parsed.data) {
        mode = parsed.data.mode;
      }
    } catch {
      // Body vazio ou invalido — usar default "1v3"
    }
    const mobCount = mode === "1v5" ? 5 : 3;

    // Verificar batalhas ativas (solo ou multi)
    const activeMultiBattleId = hasActiveMultiBattle(userId);
    if (activeMultiBattleId !== null) {
      return apiError(
        "Voce ja tem uma batalha multi ativa",
        "BATTLE_ALREADY_ACTIVE",
        409
      );
    }

    const activeSoloBattleId = hasActiveBattle(userId);
    if (activeSoloBattleId !== null) {
      return apiError(
        "Voce ja tem uma batalha solo ativa",
        "BATTLE_ALREADY_ACTIVE",
        409
      );
    }

    // Buscar character com skills equipadas
    const character = await prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        physicalAtk: true,
        physicalDef: true,
        magicAtk: true,
        magicDef: true,
        hp: true,
        speed: true,
        level: true,
        currentExp: true,
        freePoints: true,
        characterSkills: {
          where: { equipped: true },
          orderBy: { slotIndex: "asc" },
          select: {
            slotIndex: true,
            skill: {
              select: {
                id: true,
                name: true,
                description: true,
                tier: true,
                cooldown: true,
                target: true,
                damageType: true,
                basePower: true,
                hits: true,
                accuracy: true,
                effects: true,
                mastery: true,
              },
            },
          },
        },
      },
    });

    if (!character) {
      return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
    }

    if (character.characterSkills.length === 0) {
      return apiError(
        "Equipe pelo menos uma habilidade antes de batalhar",
        "NO_SKILLS_EQUIPPED",
        400
      );
    }

    // Matchmaking: selecionar 3 mobs adequados ao nivel
    const playerTier = getPlayerTier(character.level);
    const mobTier = rollMobTier(playerTier);

    let mobs = await prisma.mob.findMany({
      where: { tier: mobTier },
      include: {
        skills: {
          orderBy: { slotIndex: "asc" },
          include: { skill: true },
        },
      },
    });

    // Se nao tiver mobs suficientes no tier, tentar tier adjacente
    if (mobs.length === 0) {
      const adjacentTier = mobTier > 1 ? mobTier - 1 : mobTier + 1;
      mobs = await prisma.mob.findMany({
        where: { tier: adjacentTier },
        include: {
          skills: {
            orderBy: { slotIndex: "asc" },
            include: { skill: true },
          },
        },
      });
    }

    if (mobs.length === 0) {
      return apiError(
        "Nenhum mob disponivel para este tier",
        "NO_MOBS_AVAILABLE",
        500
      );
    }

    // Selecionar mobs (podem repetir se menos que mobCount unicos disponiveis)
    const selectedMobs: typeof mobs = [];
    const availableMobs = [...mobs];

    for (let i = 0; i < mobCount; i++) {
      if (availableMobs.length > 0) {
        const chosen = selectRandomMob(availableMobs);
        selectedMobs.push(chosen);
        // Remover para tentar pegar mobs distintos
        const idx = availableMobs.indexOf(chosen);
        if (idx !== -1) availableMobs.splice(idx, 1);
      } else {
        // Se nao tiver mais mobs distintos, repetir do pool original
        const chosen = selectRandomMob(mobs);
        selectedMobs.push(chosen);
      }
    }

    // Converter skills do player
    const playerSkills: EquippedSkill[] = character.characterSkills.map(
      (cs) => ({
        skillId: cs.skill.id,
        slotIndex: cs.slotIndex as number,
        skill: {
          id: cs.skill.id,
          name: cs.skill.name,
          description: cs.skill.description,
          tier: cs.skill.tier,
          cooldown: cs.skill.cooldown,
          target: cs.skill.target as SkillTarget,
          damageType: cs.skill.damageType as DamageType,
          basePower: cs.skill.basePower,
          hits: cs.skill.hits,
          accuracy: cs.skill.accuracy,
          effects: cs.skill.effects as Skill["effects"],
          mastery: cs.skill.mastery as SkillMastery,
        },
      })
    );

    const baseStats: BaseStats = {
      physicalAtk: character.physicalAtk,
      physicalDef: character.physicalDef,
      magicAtk: character.magicAtk,
      magicDef: character.magicDef,
      hp: character.hp,
      speed: character.speed,
    };

    const playerStats: BaseStats = await loadEquippedCardsAndApply(
      prisma,
      userId,
      baseStats,
    );

    const playerState = createPlayerState({
      userId,
      characterId: character.id,
      stats: playerStats,
      skills: playerSkills,
    });

    // Mapa mobId -> estrela do encontro daquele mob nesta batalha.
    // Se o mesmo mob aparecer mais de uma vez, a chave colapsa para o ultimo
    // roll — todas as instancias daquele mob compartilham a mesma estrela na
    // hora do drop (a logica de drop opera por mobId, nao por instancia).
    const encounterStarsMap: Record<string, EncounterStars> = {};

    // Montar MobStates (cada mob recebe seu proprio sorteio de estrela e seus
    // stats sao multiplicados antes de virar um MobState).
    const mobStates = selectedMobs.map((mob) => {
      const mobSkills: EquippedSkill[] = mob.skills.map((ms) => ({
        skillId: ms.skill.id,
        slotIndex: ms.slotIndex,
        skill: {
          id: ms.skill.id,
          name: ms.skill.name,
          description: ms.skill.description,
          tier: ms.skill.tier,
          cooldown: ms.skill.cooldown,
          target: ms.skill.target as SkillTarget,
          damageType: ms.skill.damageType as DamageType,
          basePower: ms.skill.basePower,
          hits: ms.skill.hits,
          accuracy: ms.skill.accuracy,
          effects: ms.skill.effects as Skill["effects"],
          mastery: ms.skill.mastery as SkillMastery,
        },
      }));

      const stars = rollEncounterStars(mob.maxStars);
      encounterStarsMap[mob.id] = stars;

      const baseMobStats: StatBlock = {
        physicalAtk: mob.physicalAtk,
        physicalDef: mob.physicalDef,
        magicAtk: mob.magicAtk,
        magicDef: mob.magicDef,
        hp: mob.hp,
        speed: mob.speed,
      };
      const buffed = applyStarMultiplier(baseMobStats, stars);
      const mobStats: BaseStats = {
        physicalAtk: buffed.physicalAtk,
        physicalDef: buffed.physicalDef,
        magicAtk: buffed.magicAtk,
        magicDef: buffed.magicDef,
        hp: buffed.hp,
        speed: buffed.speed,
      };

      // Cada mob instance recebe um playerId unico (mesmo que seja o mesmo mob repetido)
      const mobPlayerId = crypto.randomUUID();

      const basePlayerState = createPlayerState({
        userId: mobPlayerId,
        characterId: mob.id,
        stats: mobStats,
        skills: mobSkills,
      });

      const mobState: MobState = {
        ...basePlayerState,
        mobId: mob.id,
        profile: mob.aiProfile as AiProfile,
        defeated: false,
      };

      return mobState;
    });

    const battleId = crypto.randomUUID();

    const battleState = initMultiPveBattle({
      battleId,
      player: playerState,
      mobs: mobStates,
      mode,
    });

    setMultiPveBattle(battleId, {
      state: battleState,
      userId,
      lastActivityAt: Date.now(),
      mobsInfo: selectedMobs.map((mob) => ({
        name: mob.name,
        tier: mob.tier,
        imageUrl: mob.imageUrl ?? null,
      })),
      encounterStars: encounterStarsMap,
    });

    return apiSuccess(
      {
        battleId,
        mode,
        encounterStars: encounterStarsMap,
        mobs: selectedMobs.map((mob, index) => ({
          name: mob.name,
          tier: mob.tier,
          hp: mobStates[index].baseStats.hp,
          index,
          playerId: mobStates[index].playerId,
          imageUrl: mob.imageUrl ?? null,
        })),
        player: {
          hp: playerStats.hp,
          skills: playerSkills.map((s) => s.skill.name),
        },
        initialState: {
          turnNumber: 1,
          playerHp: playerState.currentHp,
          mobsHp: mobStates.map((m) => m.currentHp),
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve-multi/start]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
