import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle, setPveBattle } from "@/lib/battle/pve-store";
import { initBattle } from "@/lib/battle/init";
import { loadEquippedCardsAndApply } from "@/lib/cards/load-equipped";
import { getPlayerTier, rollMobTier, selectRandomMob } from "@/lib/exp/matchmaking";
import {
  rollEncounterStars,
  applyStarMultiplier,
  type StatBlock,
} from "@/lib/mobs/encounter-stars";
import type { EquippedSkill, BaseStats } from "@/lib/battle/types";
import type { AiProfile } from "@/lib/battle/ai-profiles";
import type {
  Skill,
  SkillTarget,
  DamageType,
  SkillEffect,
  SkillMastery,
} from "@/types/skill";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // Verificar batalha ativa
    const activeBattleId = hasActiveBattle(userId);
    if (activeBattleId !== null) {
      return apiError(
        "Voce ja tem uma batalha ativa",
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

    // Matchmaking: selecionar mob adequado ao nivel do jogador
    const playerTier = getPlayerTier(character.level);
    const mobTier = rollMobTier(playerTier);

    const mobs = await prisma.mob.findMany({
      where: { tier: mobTier },
      include: {
        skills: {
          orderBy: { slotIndex: "asc" },
          include: { skill: true },
        },
      },
    });

    if (mobs.length === 0) {
      return apiError(
        "Nenhum mob disponivel para este tier",
        "NO_MOBS_AVAILABLE",
        500
      );
    }

    const mob = selectRandomMob(mobs);

    // Converter characterSkills para EquippedSkill[]
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

    // Converter mobSkills para EquippedSkill[]
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

    // Sortear estrela do encontro e aplicar multiplicador nos stats do mob
    // (alteracao apenas em memoria — nao persiste no banco).
    const stars = rollEncounterStars(mob.maxStars);
    const baseMobStats: StatBlock = {
      physicalAtk: mob.physicalAtk,
      physicalDef: mob.physicalDef,
      magicAtk: mob.magicAtk,
      magicDef: mob.magicDef,
      hp: mob.hp,
      speed: mob.speed,
    };
    const buffedMobStats = applyStarMultiplier(baseMobStats, stars);
    const mobStats: BaseStats = {
      physicalAtk: buffedMobStats.physicalAtk,
      physicalDef: buffedMobStats.physicalDef,
      magicAtk: buffedMobStats.magicAtk,
      magicDef: buffedMobStats.magicDef,
      hp: buffedMobStats.hp,
      speed: buffedMobStats.speed,
    };

    const battleId = crypto.randomUUID();

    const state = initBattle({
      battleId,
      player1: {
        userId,
        characterId: character.id,
        stats: playerStats,
        skills: playerSkills,
      },
      player2: {
        userId: mob.id,
        characterId: mob.id,
        stats: mobStats,
        skills: mobSkills,
      },
    });

    setPveBattle(battleId, {
      state,
      mobProfile: mob.aiProfile as AiProfile,
      mobId: mob.id,
      userId,
      lastActivityAt: Date.now(),
      mobName: mob.name,
      mobTier: mob.tier,
      mobImageUrl: mob.imageUrl ?? null,
      mobDescription: mob.description,
      encounterStars: stars,
    });

    return apiSuccess({
      battleId,
      playerId: userId,
      mobId: mob.id,
      encounterStars: stars,
      mob: {
        name: mob.name,
        description: mob.description,
        tier: mob.tier,
        hp: mobStats.hp,
        aiProfile: mob.aiProfile,
        imageUrl: mob.imageUrl ?? null,
      },
      player: {
        hp: playerStats.hp,
        skills: playerSkills.map((s) => s.skill.name),
      },
      initialState: {
        turnNumber: state.turnNumber,
        playerHp: state.players[0].currentHp,
        mobHp: state.players[1].currentHp,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve/start]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
