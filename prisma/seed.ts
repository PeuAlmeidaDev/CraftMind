import { PrismaClient, Prisma, HabitCategory, HouseName } from '@prisma/client'
import type { SkillTarget, DamageType, SkillEffect, SkillMastery } from '../types/skill'
import { seedBosses } from './seed-bosses'

const prisma = new PrismaClient()

// ------------------------------------------------------------
// Casas
// ------------------------------------------------------------

type HouseData = {
  name: HouseName
  animal: string
  description: string
}

const houses: HouseData[] = [
  {
    name: 'ARION',
    animal: 'Leao',
    description: 'Casa do guerreiro. Forca, disciplina do corpo, saude fisica.',
  },
  {
    name: 'LYCUS',
    animal: 'Lobo',
    description: 'Casa do samurai. Equilibrio entre corpo, mente e estudo.',
  },
  {
    name: 'NOCTIS',
    animal: 'Coruja',
    description: 'Casa do sabio. Conhecimento profundo e conexao espiritual.',
  },
  {
    name: 'NEREID',
    animal: 'Sereia',
    description: 'Casa do suporte. Resistencia, comunidade e controle emocional.',
  },
]

// ------------------------------------------------------------
// Hábitos — categorias amplas escolhidas no cadastro
// Os attributeGrants ficam nas TAREFAS diárias (fase futura),
// não nos hábitos.
// ------------------------------------------------------------

type HabitData = {
  name: string
  description: string
  category: HabitCategory
}

const habits: HabitData[] = [
  // ==================== PHYSICAL (5) ====================
  { name: 'Exercicio Fisico', description: 'Fortaleça seu corpo com treinos regulares em casa', category: 'PHYSICAL' },
  { name: 'Yoga', description: 'Equilibrio entre corpo e mente atraves de posturas e fluxos', category: 'PHYSICAL' },
  { name: 'Artes Marciais', description: 'Disciplina e tecnica atraves de treinos de luta', category: 'PHYSICAL' },
  { name: 'Alongamento', description: 'Flexibilidade e recuperacao muscular diaria', category: 'PHYSICAL' },
  { name: 'Danca', description: 'Movimento, ritmo e expressao corporal', category: 'PHYSICAL' },

  // ==================== INTELLECTUAL (6) ====================
  { name: 'Leitura', description: 'Expanda seu conhecimento atraves dos livros', category: 'INTELLECTUAL' },
  { name: 'Estudos Academicos', description: 'Dedique tempo ao aprendizado formal', category: 'INTELLECTUAL' },
  { name: 'Programacao', description: 'Desenvolva logica e habilidades tecnicas', category: 'INTELLECTUAL' },
  { name: 'Idiomas', description: 'Aprenda ou pratique um novo idioma', category: 'INTELLECTUAL' },
  { name: 'Escrita Criativa', description: 'Crie textos, contos, poesia ou escrita livre', category: 'INTELLECTUAL' },
  { name: 'Xadrez e Puzzles', description: 'Exercite o raciocinio logico e estrategico', category: 'INTELLECTUAL' },

  // ==================== MENTAL (5) ====================
  { name: 'Meditacao', description: 'Acalme a mente e desenvolva foco interior', category: 'MENTAL' },
  { name: 'Journaling', description: 'Registre pensamentos e reflexoes diarias', category: 'MENTAL' },
  { name: 'Respiracao', description: 'Tecnicas de respiracao para equilibrio e calma', category: 'MENTAL' },
  { name: 'Digital Detox', description: 'Tempo intencional longe das telas', category: 'MENTAL' },
  { name: 'Planejamento do Dia', description: 'Organize prioridades e metas diarias', category: 'MENTAL' },

  // ==================== SOCIAL (4) ====================
  { name: 'Voluntariado', description: 'Contribua com causas e ajude quem precisa', category: 'SOCIAL' },
  { name: 'Mentoria', description: 'Guie e compartilhe experiencia com outros', category: 'SOCIAL' },
  { name: 'Manter Contato', description: 'Fortaleca lacos ligando ou conversando com alguem', category: 'SOCIAL' },
  { name: 'Ensinar Algo', description: 'Compartilhe conhecimento com outra pessoa', category: 'SOCIAL' },

  // ==================== SPIRITUAL (5) ====================
  { name: 'Oracao', description: 'Conexao espiritual atraves da prece', category: 'SPIRITUAL' },
  { name: 'Gratidao', description: 'Pratique o reconhecimento pelo que ha de bom na vida', category: 'SPIRITUAL' },
  { name: 'Contemplacao', description: 'Reflexao profunda e presenca no momento', category: 'SPIRITUAL' },
  { name: 'Leitura Filosofica', description: 'Textos reflexivos e de sabedoria', category: 'SPIRITUAL' },
  { name: 'Silencio Intencional', description: 'Periodo de silencio e introspecao', category: 'SPIRITUAL' },
]

// ------------------------------------------------------------
// Skills — 49 habilidades de batalha (23 T1, 17 T2, 9 T3)
// Campos de effects seguem EXATAMENTE a discriminated union
// SkillEffect em types/skill.ts
// ------------------------------------------------------------

type SkillData = {
  name: string
  description: string
  tier: number
  cooldown: number
  target: SkillTarget
  damageType: DamageType
  basePower: number
  hits: number
  accuracy: number
  effects: SkillEffect[]
  mastery: SkillMastery
}

// Nota: mastery e identica em todas as skills (maxLevel: 3, bonusPerLevel: 5).
// Futuramente, skills de tier mais alto podem ter progressao diferenciada.
const skills: SkillData[] = [
  // ==================== TIER 1 — 23 skills (cooldown 0) ====================

  // --- T1: Dano fisico single-target ---
  {
    name: 'Ataque Rapido',
    description: 'Investida agil que atinge o oponente antes que ele possa reagir',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 40, hits: 1, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Investida Selvagem',
    description: 'Avanca contra o inimigo com impeto animal',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 50, hits: 1, accuracy: 95,
    effects: [{ type: 'RECOIL', target: 'SELF', percentOfDamage: 20 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Corte Rapido',
    description: 'Lamina veloz que prioriza velocidade sobre forca',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 35, hits: 1, accuracy: 95,
    effects: [{ type: 'PRIORITY_SHIFT', target: 'SELF', stages: 1, duration: 1 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Pancada Dupla',
    description: 'Dois golpes consecutivos rapidos como um raio',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 20, hits: 2, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Chute Giratorio',
    description: 'Rotacao corporal concentrada em um unico chute devastador',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 45, hits: 1, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Dano magico single-target ---
  {
    name: 'Fagulha Arcana',
    description: 'Pequena esfera de energia magica lancada contra o alvo',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 35, hits: 1, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Rajada de Vento',
    description: 'Corrente de ar cortante que empurra e fere o oponente',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 40, hits: 1, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Toque Gelido',
    description: 'Frio sobrenatural que congela ao contato',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 40, hits: 1, accuracy: 95,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'FROZEN', chance: 15, duration: 1 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Buffs (self) ---
  {
    name: 'Foco Interior',
    description: 'Concentracao profunda que aguca os sentidos de combate',
    tier: 1, cooldown: 0, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'BUFF', target: 'SELF', stat: 'physicalAtk', value: 1, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Postura Defensiva',
    description: 'Posicao firme que reforca a resistencia fisica',
    tier: 1, cooldown: 0, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'BUFF', target: 'SELF', stat: 'physicalDef', value: 1, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Mente Agucada',
    description: 'Clareza mental que potencializa ataques magicos',
    tier: 1, cooldown: 0, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'BUFF', target: 'SELF', stat: 'magicAtk', value: 1, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Buff aliado (team modes) ---
  {
    name: 'Palavra de Coragem',
    description: 'Encoraja um aliado aumentando seu ataque fisico',
    tier: 1, cooldown: 0, target: 'SINGLE_ALLY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'BUFF', target: 'SINGLE_ALLY', stat: 'physicalAtk', value: 1, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Debuffs ---
  {
    name: 'Grito Intimidador',
    description: 'Urro feroz que abala a confianca do oponente',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 90,
    effects: [{ type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'physicalAtk', value: 1, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Olhar Penetrante',
    description: 'Um olhar que enfraquece a barreira magica do alvo',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 90,
    effects: [{ type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'magicDef', value: 1, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Provocacao',
    description: 'Palavras afiadas que desestabilizam a defesa inimiga',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 90,
    effects: [{ type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'physicalDef', value: 1, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Cura ---
  {
    name: 'Cura Vital',
    description: 'Energia restauradora que cicatriza ferimentos leves',
    tier: 1, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'HEAL', target: 'SELF', percent: 20 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Toque Restaurador',
    description: 'Canaliza energia curativa para um aliado ferido',
    tier: 1, cooldown: 1, target: 'SINGLE_ALLY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'HEAL', target: 'SINGLE_ALLY', percent: 20 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Status ---
  {
    name: 'Mordida Venenosa',
    description: 'Ataque com presas impregnadas de toxina',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 30, hits: 1, accuracy: 95,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'POISON', chance: 30, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Soco Flamejante',
    description: 'Punho envolto em chamas que queima ao impacto',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 35, hits: 1, accuracy: 95,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'BURN', chance: 20, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Onda Letargica',
    description: 'Pulso de energia que retarda os reflexos do inimigo',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 30, hits: 1, accuracy: 95,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'SLOW', chance: 30, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Cleanse ---
  {
    name: 'Purificacao',
    description: 'Luz purificadora que remove aflicoes do corpo e mente',
    tier: 1, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'CLEANSE', target: 'SELF', targets: 'ALL' }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Contra-ataque ---
  {
    name: 'Reflexo de Combate',
    description: 'Postura reativa que revida qualquer ataque recebido',
    tier: 1, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'COUNTER', target: 'SELF', powerMultiplier: 1.3, duration: 1 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T1: Vulnerabilidade ---
  {
    name: 'Marca Fragil',
    description: 'Sela magica que expoe a fraqueza do oponente',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 90,
    effects: [{ type: 'VULNERABILITY', target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', percent: 25, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // ==================== TIER 2 — 17 skills (cooldown 1) ====================

  // --- T2: Dano fisico ---
  {
    name: 'Lamina Crescente',
    description: 'Arco cortante de energia que rasga a defesa inimiga',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 65, hits: 1, accuracy: 90,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Furia de Garras',
    description: 'Sequencia feroz de tres golpes com garras afiadas',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 25, hits: 3, accuracy: 90,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Impacto Trovejante',
    description: 'Golpe devastador carregado de eletricidade',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 70, hits: 1, accuracy: 85,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'STUN', chance: 20, duration: 1 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Dano magico ---
  {
    name: 'Chama Sombria',
    description: 'Fogo negro que consome corpo e espirito',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 65, hits: 1, accuracy: 85,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'BURN', chance: 30, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Relampago Arcano',
    description: 'Descarga de energia pura canalizada dos astros',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 60, hits: 1, accuracy: 90,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Prisao de Gelo',
    description: 'Cristais congelantes que aprisionam e ferem o oponente',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 55, hits: 1, accuracy: 90,
    effects: [{ type: 'STATUS', target: 'SINGLE_ENEMY', status: 'SLOW', chance: 40, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: AoE dano (ALL_ENEMIES) ---
  {
    name: 'Onda de Choque',
    description: 'Pulso de energia que atinge todos os inimigos em campo',
    tier: 2, cooldown: 1, target: 'ALL_ENEMIES', damageType: 'PHYSICAL', basePower: 40, hits: 1, accuracy: 85,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Tempestade Arcana',
    description: 'Chuva de fragmentos magicos sobre todos os oponentes',
    tier: 2, cooldown: 1, target: 'ALL_ENEMIES', damageType: 'MAGICAL', basePower: 35, hits: 1, accuracy: 85,
    effects: [{ type: 'STATUS', target: 'ALL_ENEMIES', status: 'SLOW', chance: 20, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Buff forte / suporte ---
  {
    name: 'Veu Protetor',
    description: 'Barreira magica que eleva todas as defesas',
    tier: 2, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [
      { type: 'BUFF', target: 'SELF', stat: 'physicalDef', value: 2, duration: 3 },
      { type: 'BUFF', target: 'SELF', stat: 'magicDef', value: 1, duration: 3 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Grito de Guerra',
    description: 'Brado que fortalece todos os aliados em campo',
    tier: 2, cooldown: 1, target: 'ALL_ALLIES', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'BUFF', target: 'ALL_ALLIES', stat: 'physicalAtk', value: 1, duration: 3 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Cura forte ---
  {
    name: 'Regeneracao Profunda',
    description: 'Magia ancestral que restaura grande parte da vitalidade',
    tier: 2, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'HEAL', target: 'SELF', percent: 40 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
  {
    name: 'Brisa Curativa',
    description: 'Vento suave que restaura a saude de todos os aliados',
    tier: 2, cooldown: 1, target: 'ALL_ALLIES', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [{ type: 'HEAL', target: 'ALL_ALLIES', percent: 20 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Hibrido (dano + debuff) ---
  {
    name: 'Golpe Drenador',
    description: 'Ataque que suga a forca do oponente ao conectar',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 50, hits: 1, accuracy: 90,
    effects: [{ type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'physicalAtk', value: 1, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Cleanse + buff ---
  {
    name: 'Renascimento Interior',
    description: 'Purifica o corpo e desperta forca latente',
    tier: 2, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [
      { type: 'CLEANSE', target: 'SELF', targets: 'ALL' },
      { type: 'BUFF', target: 'SELF', stat: 'speed', value: 1, duration: 3 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Debuff forte ---
  {
    name: 'Maldicao Enfraquecedora',
    description: 'Magia sombria que corroi as capacidades do oponente',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 85,
    effects: [
      { type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'physicalAtk', value: 1, duration: 3 },
      { type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'magicAtk', value: 1, duration: 3 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Vulnerabilidade magica ---
  {
    name: 'Analise Fatal',
    description: 'Estudo rapido do oponente que revela pontos fracos magicos',
    tier: 2, cooldown: 1, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 45, hits: 1, accuracy: 90,
    effects: [{ type: 'VULNERABILITY', target: 'SINGLE_ENEMY', damageType: 'MAGICAL', percent: 30, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T2: Contra-ataque com onTrigger ---
  {
    name: 'Espinhos da Vinganca',
    description: 'Armadura espectral de espinhos que revida ataques e amaldicoa o agressor',
    tier: 2, cooldown: 1, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 0, accuracy: 100,
    effects: [{
      type: 'COUNTER',
      target: 'SELF',
      powerMultiplier: 1.5,
      duration: 1,
      onTrigger: [
        { type: 'DEBUFF', target: 'SINGLE_ENEMY', stat: 'speed', value: 1, duration: 2 },
        { type: 'VULNERABILITY', target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', percent: 25, duration: 2 },
      ],
    }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // ==================== TIER 3 — 9 skills (cooldown 2) ====================

  // --- T3: Dano magico devastador + self-debuff ---
  {
    name: 'Meteoro Abissal',
    description: 'Invoca um meteoro das profundezas que devasta tudo no impacto',
    tier: 3, cooldown: 2, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 120, hits: 1, accuracy: 80,
    effects: [{ type: 'SELF_DEBUFF', target: 'SELF', stat: 'magicAtk', value: 2, duration: 2 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: Dano fisico devastador + recoil ---
  {
    name: 'Furia do Dragao',
    description: 'Descarga total de energia fisica com furia incontrolavel',
    tier: 3, cooldown: 2, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 110, hits: 1, accuracy: 80,
    effects: [{ type: 'RECOIL', target: 'SELF', percentOfDamage: 25 }],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: Cura suprema + cleanse + buff ---
  {
    name: 'Aurora Restauradora',
    description: 'Luz celestial que cura, purifica e fortalece o espirito',
    tier: 3, cooldown: 2, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [
      { type: 'HEAL', target: 'SELF', percent: 50 },
      { type: 'CLEANSE', target: 'SELF', targets: 'ALL' },
      { type: 'BUFF', target: 'SELF', stat: 'magicDef', value: 2, duration: 3 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: Prioridade + vulnerabilidade + dano ---
  {
    name: 'Execucao Perfeita',
    description: 'Golpe unico de precisao absoluta que ignora toda defesa',
    tier: 3, cooldown: 2, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 90, hits: 1, accuracy: 80,
    effects: [
      { type: 'VULNERABILITY', target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', percent: 50, duration: 1 },
      { type: 'PRIORITY_SHIFT', target: 'SELF', stages: 1, duration: 1 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: COMBO fisico ---
  {
    name: 'Cadeia Implacavel',
    description: 'Sequencia de golpes que escala em poder a cada uso consecutivo',
    tier: 3, cooldown: 2, target: 'SINGLE_ENEMY', damageType: 'PHYSICAL', basePower: 30, hits: 1, accuracy: 85,
    effects: [
      {
        type: 'COMBO',
        maxStacks: 3,
        escalation: [
          { hits: 1, basePower: 30 },
          { hits: 2, basePower: 40 },
          { hits: 3, basePower: 55 },
        ],
      },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: COMBO magico ---
  {
    name: 'Ressonancia Arcana',
    description: 'Cada invocacao amplifica a proxima em um ciclo crescente de poder',
    tier: 3, cooldown: 2, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 35, hits: 1, accuracy: 85,
    effects: [
      {
        type: 'COMBO',
        maxStacks: 3,
        escalation: [
          { hits: 1, basePower: 35 },
          { hits: 2, basePower: 50 },
          { hits: 3, basePower: 70 },
        ],
      },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: ON_EXPIRE — buff que ao expirar cura ---
  {
    name: 'Pacto de Resiliencia',
    description: 'Defesa temporaria que ao expirar libera energia curativa',
    tier: 3, cooldown: 2, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [
      {
        type: 'ON_EXPIRE',
        trigger: { type: 'BUFF', target: 'SELF', stat: 'physicalDef', value: 2, duration: 3 },
        effect: { type: 'HEAL', target: 'SELF', percent: 30 },
      },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: ON_EXPIRE — buff de ataque que ao expirar envenena o inimigo ---
  {
    name: 'Furia Latente',
    description: 'Poder contido que ao se dissipar libera toxinas no oponente',
    tier: 3, cooldown: 2, target: 'SELF', damageType: 'NONE', basePower: 0, hits: 1, accuracy: 100,
    effects: [
      {
        type: 'ON_EXPIRE',
        trigger: { type: 'BUFF', target: 'SELF', stat: 'physicalAtk', value: 2, duration: 2 },
        effect: { type: 'STATUS', target: 'SINGLE_ENEMY', status: 'POISON', chance: 100, duration: 3 },
      },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },

  // --- T3: AoE devastador (ALL) com auto-stun ---
  {
    name: 'Cataclismo',
    description: 'Explosao total que atinge todos em campo inclusive o usuario',
    tier: 3, cooldown: 2, target: 'ALL', damageType: 'MAGICAL', basePower: 80, hits: 1, accuracy: 75,
    effects: [
      { type: 'STATUS', target: 'SELF', status: 'STUN', chance: 100, duration: 1 },
    ],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
]

// ------------------------------------------------------------
// Main seed
// ------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Seeding houses...')
  for (const house of houses) {
    await prisma.house.upsert({
      where: { name: house.name },
      update: {
        animal: house.animal,
        description: house.description,
      },
      create: house,
    })
  }
  console.log(`  ${houses.length} houses upserted.`)

  console.log('Seeding habits...')
  for (const habit of habits) {
    await prisma.habit.upsert({
      where: { name: habit.name },
      update: {
        description: habit.description,
        category: habit.category,
      },
      create: {
        name: habit.name,
        description: habit.description,
        category: habit.category,
      },
    })
  }
  console.log(`  ${habits.length} habits upserted.`)

  console.log('Seeding skills...')
  for (const skill of skills) {
    const { name, ...rest } = skill
    await prisma.skill.upsert({
      where: { name },
      update: {
        ...rest,
        effects: rest.effects as unknown as Prisma.InputJsonValue,
        mastery: rest.mastery as unknown as Prisma.InputJsonValue,
      },
      create: {
        name,
        ...rest,
        effects: rest.effects as unknown as Prisma.InputJsonValue,
        mastery: rest.mastery as unknown as Prisma.InputJsonValue,
      },
    })
  }
  console.log(`  ${skills.length} skills upserted.`)

  // ------------------------------------------------------------
  // Mobs — Inimigos PvE (12 mobs, tiers 1-5)
  // ------------------------------------------------------------

  type MobData = {
    name: string
    description: string
    tier: number
    aiProfile: string
    physicalAtk: number
    physicalDef: number
    magicAtk: number
    magicDef: number
    hp: number
    speed: number
    imageUrl: string
    skills: [string, string, string, string]
  }

  const mobs: MobData[] = [
    // Tier 1
    {
      name: 'Slime Verdejante', description: 'Criatura gelatinosa encontrada nos arredores da vila. Facil de vencer, dificil de subestimar.',
      tier: 1, aiProfile: 'BALANCED',
      physicalAtk: 10, physicalDef: 12, magicAtk: 10, magicDef: 10, hp: 120, speed: 10,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721358/craft-mind/monsters/slime.jpg',
      skills: ['Ataque Rapido', 'Fagulha Arcana', 'Cura Vital', 'Postura Defensiva'],
    },
    {
      name: 'Rato de Esgoto', description: 'Roedor agressivo que ataca sem hesitar. Rapido e imprevisivel.',
      tier: 1, aiProfile: 'AGGRESSIVE',
      physicalAtk: 14, physicalDef: 10, magicAtk: 10, magicDef: 10, hp: 100, speed: 13,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721359/craft-mind/monsters/rato-esgoto.jpg',
      skills: ['Mordida Venenosa', 'Investida Selvagem', 'Corte Rapido', 'Pancada Dupla'],
    },
    {
      name: 'Morcego Sombrio', description: 'Criatura noturna que enfraquece suas presas antes de atacar.',
      tier: 1, aiProfile: 'TACTICAL',
      physicalAtk: 11, physicalDef: 10, magicAtk: 13, magicDef: 11, hp: 95, speed: 15,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721360/craft-mind/monsters/morcego.jpg',
      skills: ['Onda Letargica', 'Grito Intimidador', 'Olhar Penetrante', 'Fagulha Arcana'],
    },
    // Tier 2
    {
      name: 'Golem de Pedra', description: 'Construto de rocha que absorve golpes como se fossem nada.',
      tier: 2, aiProfile: 'DEFENSIVE',
      physicalAtk: 22, physicalDef: 30, magicAtk: 20, magicDef: 25, hp: 250, speed: 20,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721361/craft-mind/monsters/golem-de-pedra.jpg',
      skills: ['Veu Protetor', 'Reflexo de Combate', 'Cura Vital', 'Impacto Trovejante'],
    },
    {
      name: 'Lobo Fantasma', description: 'Predador espectral que caca em silencio e ataca com ferocidade.',
      tier: 2, aiProfile: 'AGGRESSIVE',
      physicalAtk: 28, physicalDef: 22, magicAtk: 20, magicDef: 20, hp: 200, speed: 27,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721361/craft-mind/monsters/lobo-fantasma.jpg',
      skills: ['Lamina Crescente', 'Furia de Garras', 'Investida Selvagem', 'Provocacao'],
    },
    {
      name: 'Feiticeira das Sombras', description: 'Maga sombria que manipula o campo de batalha com maldicoes.',
      tier: 2, aiProfile: 'TACTICAL',
      physicalAtk: 20, physicalDef: 22, magicAtk: 28, magicDef: 25, hp: 190, speed: 24,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721362/craft-mind/monsters/feiticeira-das-sombras.jpg',
      skills: ['Chama Sombria', 'Maldicao Enfraquecedora', 'Analise Fatal', 'Prisao de Gelo'],
    },
    // Tier 3
    {
      name: 'Cavaleiro Maldito', description: 'Guerreiro condenado que luta com a forca de uma maldicao eterna.',
      tier: 3, aiProfile: 'BALANCED',
      physicalAtk: 45, physicalDef: 42, magicAtk: 35, magicDef: 38, hp: 380, speed: 38,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721363/craft-mind/monsters/cavaleiro-maldito.jpg',
      skills: ['Lamina Crescente', 'Impacto Trovejante', 'Veu Protetor', 'Regeneracao Profunda'],
    },
    {
      name: 'Serpente Venenosa', description: 'Serpente mortal que envenena e congela suas vitimas.',
      tier: 3, aiProfile: 'TACTICAL',
      physicalAtk: 40, physicalDef: 35, magicAtk: 42, magicDef: 40, hp: 350, speed: 48,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721363/craft-mind/monsters/serpente-venenosa.jpg',
      skills: ['Mordida Venenosa', 'Prisao de Gelo', 'Espinhos da Vinganca', 'Analise Fatal'],
    },
    {
      name: 'Elemental de Fogo', description: 'Espirito flamejante que reduz tudo a cinzas com poder arcano.',
      tier: 3, aiProfile: 'AGGRESSIVE',
      physicalAtk: 38, physicalDef: 36, magicAtk: 50, magicDef: 35, hp: 320, speed: 42,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721364/craft-mind/monsters/elemental-fogo.jpg',
      skills: ['Chama Sombria', 'Relampago Arcano', 'Soco Flamejante', 'Onda de Choque'],
    },
    // Tier 4
    {
      name: 'Dragao Jovem', description: 'Filhote de dragao ja capaz de destruicao massiva.',
      tier: 4, aiProfile: 'AGGRESSIVE',
      physicalAtk: 70, physicalDef: 60, magicAtk: 65, magicDef: 55, hp: 550, speed: 58,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721365/craft-mind/monsters/dragao-filhote.jpg',
      skills: ['Furia do Dragao', 'Meteoro Abissal', 'Lamina Crescente', 'Cura Vital'],
    },
    {
      name: 'Lich Anciaa', description: 'Feiticeira imortal que se sustenta drenando a forca dos vivos.',
      tier: 4, aiProfile: 'DEFENSIVE',
      physicalAtk: 55, physicalDef: 65, magicAtk: 75, magicDef: 70, hp: 500, speed: 55,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721366/craft-mind/monsters/lich-ancia.jpg',
      skills: ['Aurora Restauradora', 'Chama Sombria', 'Maldicao Enfraquecedora', 'Espinhos da Vinganca'],
    },
    // Tier 5
    {
      name: 'Arauto do Abismo', description: 'Entidade primordial que habita as profundezas. Poucos sobrevivem ao encontro.',
      tier: 5, aiProfile: 'TACTICAL',
      physicalAtk: 90, physicalDef: 85, magicAtk: 100, magicDef: 90, hp: 800, speed: 80,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721367/craft-mind/monsters/arauto-abismo.jpg',
      skills: ['Meteoro Abissal', 'Ressonancia Arcana', 'Aurora Restauradora', 'Execucao Perfeita'],
    },
  ]

  console.log('Seeding mobs...')
  for (const mobData of mobs) {
    const { skills: skillNames, ...mobFields } = mobData

    const mob = await prisma.mob.upsert({
      where: { name: mobFields.name },
      update: {
        description: mobFields.description,
        tier: mobFields.tier,
        aiProfile: mobFields.aiProfile,
        physicalAtk: mobFields.physicalAtk,
        physicalDef: mobFields.physicalDef,
        magicAtk: mobFields.magicAtk,
        magicDef: mobFields.magicDef,
        hp: mobFields.hp,
        speed: mobFields.speed,
        imageUrl: mobFields.imageUrl,
      },
      create: mobFields,
    })

    // Buscar skills pelo nome exato
    const skillRecords = await Promise.all(
      skillNames.map((name) =>
        prisma.skill.findUniqueOrThrow({ where: { name } })
      )
    )

    // Deletar MobSkills existentes para idempotencia
    await prisma.mobSkill.deleteMany({ where: { mobId: mob.id } })

    // Criar os 4 MobSkill com slotIndex 0-3
    await prisma.mobSkill.createMany({
      data: skillRecords.map((skill, index) => ({
        mobId: mob.id,
        skillId: skill.id,
        slotIndex: index,
      })),
    })
  }
  console.log(`  ${mobs.length} mobs upserted with skills.`)

  console.log('Seeding bosses...')
  await seedBosses()

  console.log('Seed completed successfully.')
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
