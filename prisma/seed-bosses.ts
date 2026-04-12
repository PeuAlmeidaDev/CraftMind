import { PrismaClient, HabitCategory } from '@prisma/client'

type BossData = {
  name: string
  description: string
  lore: string
  category: HabitCategory
  tier: number
  aiProfile: string
  physicalAtk: number
  physicalDef: number
  magicAtk: number
  magicDef: number
  hp: number
  speed: number
  skills: [string, string, string, string]
}

const bosses: BossData[] = [
  // ==================== PHYSICAL ====================
  {
    name: 'Colosso de Ferro',
    description: 'Gigante blindado que esmaga tudo em seu caminho.',
    lore: 'Forjado nas profundezas de uma montanha vulcanica, o Colosso de Ferro foi criado por ferreiros amaldicoados. Sua armadura absorve golpes e os devolve com forca triplicada.',
    category: 'PHYSICAL', tier: 3, aiProfile: 'AGGRESSIVE',
    physicalAtk: 140, physicalDef: 120, magicAtk: 100, magicDef: 110, hp: 800, speed: 105,
    skills: ['Onda de Choque', 'Furia do Dragao', 'Impacto Trovejante', 'Veu Protetor'],
  },
  {
    name: 'Berserker Sanguinario',
    description: 'Guerreiro enlouquecido que nao sente dor.',
    lore: 'Outrora um campeao honrado, o Berserker perdeu a razao apos um ritual proibido. Agora vaga pelos campos de batalha buscando oponentes dignos. Cada golpe seu carrega o peso de mil derrotas.',
    category: 'PHYSICAL', tier: 2, aiProfile: 'AGGRESSIVE',
    physicalAtk: 85, physicalDef: 65, magicAtk: 60, magicDef: 60, hp: 400, speed: 80,
    skills: ['Onda de Choque', 'Lamina Crescente', 'Furia de Garras', 'Grito de Guerra'],
  },

  // ==================== INTELLECTUAL ====================
  {
    name: 'Oraculo das Ruinas',
    description: 'Entidade arcana que manipula o tempo e o espaco.',
    lore: 'Guardiao de uma biblioteca esquecida pelo mundo, o Oraculo absorveu o conhecimento de mil tomos proibidos. Suas magias distorcem a realidade e confundem ate os mais sabios.',
    category: 'INTELLECTUAL', tier: 4, aiProfile: 'TACTICAL',
    physicalAtk: 150, physicalDef: 160, magicAtk: 220, magicDef: 200, hp: 1200, speed: 170,
    skills: ['Tempestade Arcana', 'Meteoro Abissal', 'Ressonancia Arcana', 'Aurora Restauradora'],
  },
  {
    name: 'Alquimista Corrompido',
    description: 'Cientista louco que transforma materia em destruicao.',
    lore: 'Seus experimentos com essencia vital deram errado e fundiram seu corpo com energia arcana instavel. Agora ele canaliza essa energia caotida em ataques devastadores.',
    category: 'INTELLECTUAL', tier: 2, aiProfile: 'TACTICAL',
    physicalAtk: 60, physicalDef: 70, magicAtk: 90, magicDef: 75, hp: 350, speed: 70,
    skills: ['Tempestade Arcana', 'Chama Sombria', 'Analise Fatal', 'Regeneracao Profunda'],
  },

  // ==================== MENTAL ====================
  {
    name: 'Espectro da Insonia',
    description: 'Fantasma que atormenta a mente de suas vitimas.',
    lore: 'Nascido do sofrimento coletivo de uma cidade devastada pela praga, o Espectro se alimenta do medo alheio. Sua presenca drena a vontade de lutar e mergulha os oponentes em desespero.',
    category: 'MENTAL', tier: 3, aiProfile: 'DEFENSIVE',
    physicalAtk: 100, physicalDef: 130, magicAtk: 145, magicDef: 150, hp: 700, speed: 120,
    skills: ['Cataclismo', 'Prisao de Gelo', 'Maldicao Enfraquecedora', 'Espinhos da Vinganca'],
  },
  {
    name: 'Monge do Vazio',
    description: 'Asceta que transcendeu a dor e controla a inercia.',
    lore: 'Apos decadas de meditacao no topo de um pico gelado, o Monge descobriu como silenciar nao so sua mente, mas a de todos ao redor. Seus golpes parecem lentos, mas chegam antes que qualquer reacao.',
    category: 'MENTAL', tier: 2, aiProfile: 'BALANCED',
    physicalAtk: 70, physicalDef: 80, magicAtk: 75, magicDef: 85, hp: 450, speed: 90,
    skills: ['Onda de Choque', 'Relampago Arcano', 'Onda Letargica', 'Pacto de Resiliencia'],
  },

  // ==================== SOCIAL ====================
  {
    name: 'Imperatriz das Sombras',
    description: 'Lider carismática que comanda um exercito espectral.',
    lore: 'Governa um reino de almas perdidas com punho de ferro e voz de seda. Aqueles que ouvem sua ordem nao conseguem desobedece-la. Seus servos lutam com fervor fanatico em seu nome.',
    category: 'SOCIAL', tier: 4, aiProfile: 'BALANCED',
    physicalAtk: 170, physicalDef: 180, magicAtk: 200, magicDef: 190, hp: 1100, speed: 160,
    skills: ['Cataclismo', 'Execucao Perfeita', 'Maldicao Enfraquecedora', 'Aurora Restauradora'],
  },
  {
    name: 'Enganador Mascarado',
    description: 'Trapaceiro que usa ilusoes para confundir adversarios.',
    lore: 'Ninguem sabe seu verdadeiro rosto. Usa mascaras que alteram a percepcao de quem o enfrenta, fazendo aliados parecerem inimigos. Vence-lo exige mais do que forca — exige confianca inabalavel no grupo.',
    category: 'SOCIAL', tier: 3, aiProfile: 'TACTICAL',
    physicalAtk: 110, physicalDef: 115, magicAtk: 135, magicDef: 130, hp: 650, speed: 140,
    skills: ['Tempestade Arcana', 'Cadeia Implacavel', 'Analise Fatal', 'Brisa Curativa'],
  },

  // ==================== SPIRITUAL ====================
  {
    name: 'Devorador de Almas',
    description: 'Demonio ancestral que se alimenta de essencia vital.',
    lore: 'Emergiu de uma fenda entre mundos durante um eclipse milenar. Cada alma que consome fortalece sua forma fisica e magica. Os sabios dizem que so pode ser derrotado quando sua fome o cega.',
    category: 'SPIRITUAL', tier: 4, aiProfile: 'AGGRESSIVE',
    physicalAtk: 200, physicalDef: 170, magicAtk: 210, magicDef: 175, hp: 1300, speed: 180,
    skills: ['Cataclismo', 'Meteoro Abissal', 'Furia do Dragao', 'Regeneracao Profunda'],
  },
  {
    name: 'Guardiao do Limiar',
    description: 'Sentinela entre o mundo dos vivos e o alem.',
    lore: 'Designado pelos deuses antigos para vigiar a passagem entre planos, o Guardiao testa todos que se aproximam. Sua aprovacao concede iluminacao; sua furia, aniquilacao.',
    category: 'SPIRITUAL', tier: 2, aiProfile: 'DEFENSIVE',
    physicalAtk: 65, physicalDef: 90, magicAtk: 80, magicDef: 85, hp: 500, speed: 60,
    skills: ['Onda de Choque', 'Chama Sombria', 'Olhar Penetrante', 'Veu Protetor'],
  },
]

export async function seedBosses(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    for (const bossData of bosses) {
      const { skills: skillNames, ...bossFields } = bossData

      const boss = await prisma.boss.upsert({
        where: { name: bossFields.name },
        update: {
          description: bossFields.description,
          lore: bossFields.lore,
          category: bossFields.category,
          tier: bossFields.tier,
          aiProfile: bossFields.aiProfile,
          physicalAtk: bossFields.physicalAtk,
          physicalDef: bossFields.physicalDef,
          magicAtk: bossFields.magicAtk,
          magicDef: bossFields.magicDef,
          hp: bossFields.hp,
          speed: bossFields.speed,
        },
        create: bossFields,
      })

      // Buscar skills pelo nome exato
      const skillRecords = await Promise.all(
        skillNames.map((name) =>
          prisma.skill.findUniqueOrThrow({ where: { name } })
        )
      )

      // Deletar BossSkills existentes para idempotencia
      await prisma.bossSkill.deleteMany({ where: { bossId: boss.id } })

      // Criar os 4 BossSkill com slotIndex 0-3
      await prisma.bossSkill.createMany({
        data: skillRecords.map((skill, index) => ({
          bossId: boss.id,
          skillId: skill.id,
          slotIndex: index,
        })),
      })
    }

    console.log(`  ${bosses.length} bosses upserted with skills.`)
  } finally {
    await prisma.$disconnect()
  }
}
