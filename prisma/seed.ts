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
  { name: 'Estudos de Tecnologia', description: 'Desenvolva logica e habilidades tecnicas', category: 'INTELLECTUAL' },
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
  { name: 'Pratica da Religiao', description: 'Conexao espiritual atraves da pratica religiosa', category: 'SPIRITUAL' },
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
    name: 'Bola de Fogo',
    description: 'Esfera flamejante que incendeia o alvo com puro poder magico',
    tier: 1, cooldown: 0, target: 'SINGLE_ENEMY', damageType: 'MAGICAL', basePower: 40, hits: 1, accuracy: 95,
    effects: [],
    mastery: { maxLevel: 3, bonusPerLevel: 5 },
  },
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
    loreExpanded: string
    curiosity: string
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
    maxStars?: number
  }

  const mobs: MobData[] = [
    // Tier 1
    {
      name: 'Slime Verdejante', description: 'Criatura gelatinosa encontrada nos arredores da vila. Facil de vencer, dificil de subestimar.',
      loreExpanded: 'Os Slimes Verdejantes nasceram quando a primeira chuva pos-Velthara caiu sobre o cerne podre dos campos. Cada gota carregava um eco de magia e, ao tocar a folhagem, condensou-se em corpos gelatinosos sem osso, sem voz e sem memoria propria. Dizem que ao tocar um Slime nu, voce escuta o rumor distante da chuva original.',
      curiosity: 'Slimes Verdejantes nao tem boca: absorvem nutrientes pelo proprio corpo. Aldeoes da era Meiji acreditavam que esfregar um Slime na ferida acelerava a cura — sem evidencia, mas com folclore farto.',
      tier: 1, aiProfile: 'BALANCED',
      physicalAtk: 10, physicalDef: 12, magicAtk: 10, magicDef: 10, hp: 120, speed: 10,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721358/craft-mind/monsters/slime.jpg',
      skills: ['Ataque Rapido', 'Fagulha Arcana', 'Cura Vital', 'Postura Defensiva'],
      maxStars: 3,
    },
    {
      name: 'Rato de Esgoto', description: 'Roedor agressivo que ataca sem hesitar. Rapido e imprevisivel.',
      loreExpanded: 'Os Ratos de Esgoto descendem das colonias que sobreviveram ao incendio da Velha Yokai-cho. Forjados por gerações no breu dos canos sob a cidade, evoluiram presas aceradas e um senso de territorio que ferve a primeira ofensa. Caçadores juram que cada rato carrega no faro o cheiro do dono da colmeia perdida — e morrera para reencontra-lo.',
      curiosity: 'Apesar do tamanho, um Rato de Esgoto adulto consegue atravessar uma rua de pedra em meio segundo. Seu rastro deixa marcas em zig-zag — nunca uma linha reta, supersticao herdada do tempo em que evitavam armadilhas dos antigos magos.',
      tier: 1, aiProfile: 'AGGRESSIVE',
      physicalAtk: 14, physicalDef: 10, magicAtk: 10, magicDef: 10, hp: 100, speed: 13,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721359/craft-mind/monsters/rato-esgoto.jpg',
      skills: ['Mordida Venenosa', 'Investida Selvagem', 'Corte Rapido', 'Pancada Dupla'],
    },
    {
      name: 'Morcego Sombrio', description: 'Criatura noturna que enfraquece suas presas antes de atacar.',
      loreExpanded: 'Habitam as cavernas que circundam Velthara desde antes da fundacao da cidade. Os Morcegos Sombrios escutam emocoes mais alto que sons — bracos tremulos, batimentos acelerados, medo. Investem na hora exata em que o coracao de um caçador titubeia. Quem aprende a calmar a respiracao na escuridao, raramente e ferido por um deles.',
      curiosity: 'Morcegos Sombrios nao usam ecolocalizacao: enxergam o calor residual de um movimento como se fosse uma mancha brilhante no ar. Caçar a frio (ficar parado por minutos) confunde a criatura.',
      tier: 1, aiProfile: 'TACTICAL',
      physicalAtk: 11, physicalDef: 10, magicAtk: 13, magicDef: 11, hp: 95, speed: 15,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721360/craft-mind/monsters/morcego.jpg',
      skills: ['Onda Letargica', 'Grito Intimidador', 'Olhar Penetrante', 'Fagulha Arcana'],
    },
    // Tier 2
    {
      name: 'Golem de Pedra', description: 'Construto de rocha que absorve golpes como se fossem nada.',
      loreExpanded: 'Construidos por antigas escolas de geomancia para guardar os arquivos do Conselho de Velthara, os Golens de Pedra sobreviveram aos seus mestres. Hoje vagam ruinas defendendo cofres que nao se abrem ha seculos — e cuja chave ja ninguem lembra. Quando um Golem se quebra, sussurra um nome ao vento. Pesquisadores tentam catalogar: cada nome corresponde a um magista enterrado.',
      curiosity: 'Golens de Pedra dormem em pe quando seus runesmiths morrem. Pode-se passar decadas ao lado de um sem perceber que ele e mais que uma estatua. Tocar a runa do peito enquanto ele dorme acorda o construto — gesto raramente prudente.',
      tier: 2, aiProfile: 'DEFENSIVE',
      physicalAtk: 22, physicalDef: 30, magicAtk: 20, magicDef: 25, hp: 250, speed: 20,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721361/craft-mind/monsters/golem-de-pedra.jpg',
      skills: ['Veu Protetor', 'Reflexo de Combate', 'Cura Vital', 'Impacto Trovejante'],
    },
    {
      name: 'Lobo Fantasma', description: 'Predador espectral que caca em silencio e ataca com ferocidade.',
      loreExpanded: 'Os Lobos Fantasma nascem quando uma alcateia inteira tomba na mesma luna sem ser sepultada. Suas almas se enrolam no fragmento lunar mais frio da floresta e, no proximo ciclo, retornam translucidos. Eles caçam em alcateia mesmo quando aparentemente sozinhos — voce nunca enfrenta um, voce enfrenta o eco dos outros que voce nao ve.',
      curiosity: 'Um Lobo Fantasma nao deixa pegadas, mas a grama onde pisou seca por uma semana. Caçadores experientes conseguem rastrear o caminho deles por essa cicatriz vegetal.',
      tier: 2, aiProfile: 'AGGRESSIVE',
      physicalAtk: 28, physicalDef: 22, magicAtk: 20, magicDef: 20, hp: 200, speed: 27,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721361/craft-mind/monsters/lobo-fantasma.jpg',
      skills: ['Lamina Crescente', 'Furia de Garras', 'Investida Selvagem', 'Provocacao'],
    },
    {
      name: 'Feiticeira das Sombras', description: 'Maga sombria que manipula o campo de batalha com maldicoes.',
      loreExpanded: 'Antes do Conselho cair, varias maguistas de Velthara estudavam o lado nao iluminado das esferas — magia que se alimenta da incerteza alheia. As Feiticeiras das Sombras sao herdeiras dessa linhagem proscrita: vivem nos limites do mapa, ensinando a si mesmas o que nenhum mestre quis transmitir. Cada maldicao que lancam carrega uma fragmento da propria duvida.',
      curiosity: 'Uma Feiticeira das Sombras nunca diz seu nome verdadeiro em voz alta — acreditam que cada vez que o nome e pronunciado, a feiticeira perde um ano de vida. Por isso so se referem umas as outras por epitetos opacos.',
      tier: 2, aiProfile: 'TACTICAL',
      physicalAtk: 20, physicalDef: 22, magicAtk: 28, magicDef: 25, hp: 190, speed: 24,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721362/craft-mind/monsters/feiticeira-das-sombras.jpg',
      skills: ['Chama Sombria', 'Maldicao Enfraquecedora', 'Analise Fatal', 'Prisao de Gelo'],
    },
    // Tier 3
    {
      name: 'Cavaleiro Maldito', description: 'Guerreiro condenado que luta com a forca de uma maldicao eterna.',
      loreExpanded: 'Em vida, o Cavaleiro Maldito jurou ao Conselho de Velthara proteger seu lorde acima da propria honra. No dia em que o lorde traiu o Conselho, o cavaleiro nao soube escolher: matou o lorde e morreu pelo juramento quebrado, no mesmo gesto. A maldicao o ergueu de novo — para que sempre tenha que escolher, e nunca consiga descansar com nenhuma das escolhas.',
      curiosity: 'A armadura do Cavaleiro Maldito sangra quando ele e ferido. Quem segura uma gota dessa "lagrima de aco" no punho fechado por uma noite, recebe um sonho com a pessoa que ele mais ama na propria vida — e acorda chorando.',
      tier: 3, aiProfile: 'BALANCED',
      physicalAtk: 45, physicalDef: 42, magicAtk: 35, magicDef: 38, hp: 380, speed: 38,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721363/craft-mind/monsters/cavaleiro-maldito.jpg',
      skills: ['Lamina Crescente', 'Impacto Trovejante', 'Veu Protetor', 'Regeneracao Profunda'],
    },
    {
      name: 'Serpente Venenosa', description: 'Serpente mortal que envenena e congela suas vitimas.',
      loreExpanded: 'A Serpente Venenosa e uma das poucas criaturas pre-Velthara que sobreviveu a queda do Conselho. Seu veneno carrega um eco da magia primitiva — nao mata pelo sangue, mata pelo tempo: sua vitima envelhece anos em segundos, congelando por dentro enquanto a serpente se afasta. Aldeoes idosos da era Meiji acreditavam que toda velhice prematura era assinatura dela.',
      curiosity: 'A Serpente Venenosa muda de pele a cada lua nova. A pele descartada permanece quente por 12 horas — herborarios usam-na como compressa para congelamento, paradoxalmente.',
      tier: 3, aiProfile: 'TACTICAL',
      physicalAtk: 40, physicalDef: 35, magicAtk: 42, magicDef: 40, hp: 350, speed: 48,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721363/craft-mind/monsters/serpente-venenosa.jpg',
      skills: ['Mordida Venenosa', 'Prisao de Gelo', 'Espinhos da Vinganca', 'Analise Fatal'],
    },
    {
      name: 'Elemental de Fogo', description: 'Espirito flamejante que reduz tudo a cinzas com poder arcano.',
      loreExpanded: 'Os Elementais de Fogo sao chamas que ganharam vontade. Nascem quando incendios se sobrepoem ao desejo coletivo — uma vila que queima junto com a saudade dos seus mortos pode acender um Elemental dali a uma lua. Eles nao odeiam: amam tudo o que tocam, ate consumir. Por isso sao vistos como tragedia romantica, nao como monstro.',
      curiosity: 'Um Elemental de Fogo nao queima a propria sombra. Quando ele para imovel num campo aberto, ha uma area no chao mais fria que o resto — onde se projeta a sua silhueta de luz. Nessa marca cresce trevo branco em horas.',
      tier: 3, aiProfile: 'AGGRESSIVE',
      physicalAtk: 38, physicalDef: 36, magicAtk: 50, magicDef: 35, hp: 320, speed: 42,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721364/craft-mind/monsters/elemental-fogo.jpg',
      skills: ['Chama Sombria', 'Relampago Arcano', 'Soco Flamejante', 'Onda de Choque'],
    },
    // Tier 4
    {
      name: 'Dragao Jovem', description: 'Filhote de dragao ja capaz de destruicao massiva.',
      loreExpanded: 'Um Dragao Jovem e tudo que sobrou da era em que dragoes adultos guiavam guerras. Seus pais foram caçados pelo Conselho de Velthara antes que ele aprendesse a voar mais alto que uma muralha. Cresceu sozinho num penhasco — a furia dele nao e maldade, e luto. Cada chama que ele cospe carrega o nome de um irmao que nunca conheceu.',
      curiosity: 'Dragoes Jovens dormem 200 anos antes de virarem adultos. Quem encontra um Dragao Jovem dormindo, encontra-o imovel sob uma camada espessa de musgo dourado — facil confundi-lo com uma colina. Acordar um e a desgraca classica de muitos exploradores.',
      tier: 4, aiProfile: 'AGGRESSIVE',
      physicalAtk: 70, physicalDef: 60, magicAtk: 65, magicDef: 55, hp: 550, speed: 58,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721365/craft-mind/monsters/dragao-filhote.jpg',
      skills: ['Furia do Dragao', 'Meteoro Abissal', 'Lamina Crescente', 'Cura Vital'],
    },
    {
      name: 'Lich Anciaa', description: 'Feiticeira imortal que se sustenta drenando a forca dos vivos.',
      loreExpanded: 'A Lich Anciaa fundou tres das primeiras escolas de magia de Velthara antes de fingir a propria morte. Quando o Conselho descobriu que ela acumulava conhecimento proibido nos seus manuscritos, ja era tarde: ela havia transposto sua consciencia para um cristal de osso. Hoje, a Lich nao busca poder — busca outra mente capaz de continuar seu estudo. Mas drena cada candidato antes de aprovar.',
      curiosity: 'A Lich Anciaa nao envelhece, mas seu cristal central fissura mais a cada seculo. Quando o cristal racha o suficiente, ela escolhe um discipulo — e some pra sempre. Ja se conta seis "Liches Ancianos" desde o primeiro registro: provavelmente foi sempre a mesma.',
      tier: 4, aiProfile: 'DEFENSIVE',
      physicalAtk: 55, physicalDef: 65, magicAtk: 75, magicDef: 70, hp: 500, speed: 55,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721366/craft-mind/monsters/lich-ancia.jpg',
      skills: ['Aurora Restauradora', 'Chama Sombria', 'Maldicao Enfraquecedora', 'Espinhos da Vinganca'],
    },
    // Tier 5
    {
      name: 'Arauto do Abismo', description: 'Entidade primordial que habita as profundezas. Poucos sobrevivem ao encontro.',
      loreExpanded: 'O Arauto do Abismo nao e uma criatura — e a voz de algo que existia antes de o mundo ter cor. Quando o Conselho de Velthara escavou fundo demais buscando a fonte da magia, encontrou uma porta. Tentaram fechar. Falharam. Hoje, o Arauto e o mensageiro do que esta do outro lado: avisa, em batalha, que voce nao deveria ter chegado tao longe. E faz cumprir o aviso.',
      curiosity: 'Os olhos do Arauto do Abismo nao tem pupila — tem um vazio que reflete o que voce mais teme em vez do seu rosto. Por isso veteranos que sobrevivem a um encontro frequentemente perdem a fala por dias: nao por trauma do combate, mas por terem visto o que carregavam dentro de si.',
      tier: 5, aiProfile: 'TACTICAL',
      physicalAtk: 90, physicalDef: 85, magicAtk: 100, magicDef: 90, hp: 800, speed: 80,
      imageUrl: 'https://res.cloudinary.com/dif33bta3/image/upload/v1776721367/craft-mind/monsters/arauto-abismo.jpg',
      skills: ['Meteoro Abissal', 'Ressonancia Arcana', 'Aurora Restauradora', 'Execucao Perfeita'],
    },
  ]

  console.log('Seeding mobs...')
  for (const mobData of mobs) {
    const { skills: skillNames, ...mobFields } = mobData

    const maxStars = mobFields.maxStars ?? 1
    const mob = await prisma.mob.upsert({
      where: { name: mobFields.name },
      update: {
        description: mobFields.description,
        loreExpanded: mobFields.loreExpanded,
        curiosity: mobFields.curiosity,
        tier: mobFields.tier,
        aiProfile: mobFields.aiProfile,
        physicalAtk: mobFields.physicalAtk,
        physicalDef: mobFields.physicalDef,
        magicAtk: mobFields.magicAtk,
        magicDef: mobFields.magicDef,
        hp: mobFields.hp,
        speed: mobFields.speed,
        imageUrl: mobFields.imageUrl,
        maxStars,
      },
      create: { ...mobFields, maxStars },
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

  // ------------------------------------------------------------
  // Cards — Cristais de Memoria (1 por mob)
  // ------------------------------------------------------------

  type CardEffect =
    | { type: 'STAT_FLAT'; stat: string; value: number }
    | { type: 'STAT_PERCENT'; stat: string; percent: number }
    | { type: 'TRIGGER'; trigger: string; payload: Record<string, unknown> }
    | { type: 'STATUS_RESIST'; status: string; percent: number }

  type CardSeedData = {
    mobName: string
    name: string
    flavorText: string
    rarity: 'COMUM' | 'INCOMUM' | 'RARO' | 'EPICO' | 'LENDARIO'
    effects: CardEffect[]
  }

  const cards: CardSeedData[] = [
    // T1 (3 mobs) — 1 efeito flat moderado
    {
      mobName: 'Slime Verdejante',
      name: 'Cristal do Slime Verdejante',
      flavorText: 'Fragmento lunar onde a chuva primordial ainda escorre — gosma, calmaria, recomeço.',
      rarity: 'COMUM',
      effects: [{ type: 'STAT_FLAT', stat: 'hp', value: 8 }],
    },
    {
      mobName: 'Rato de Esgoto',
      name: 'Cristal do Rato de Esgoto',
      flavorText: 'Fragmento lunar guardando o eco de patinhas no breu — agilidade nos cantos do mapa.',
      rarity: 'COMUM',
      effects: [{ type: 'STAT_FLAT', stat: 'speed', value: 3 }],
    },
    {
      mobName: 'Morcego Sombrio',
      name: 'Cristal do Morcego Sombrio',
      flavorText: 'Fragmento lunar que pulsa com calor residual — enxergar onde os outros tropecam.',
      rarity: 'COMUM',
      effects: [{ type: 'STAT_FLAT', stat: 'magicAtk', value: 5 }],
    },
    // T2 (3) — 1 flat + 1 percent (5%)
    {
      mobName: 'Golem de Pedra',
      name: 'Cristal do Golem de Pedra',
      flavorText: 'Fragmento lunar gravado com runas extintas — o peso do que foi guardado por seculos.',
      rarity: 'INCOMUM',
      effects: [
        { type: 'STAT_FLAT', stat: 'physicalDef', value: 6 },
        { type: 'STAT_PERCENT', stat: 'hp', percent: 5 },
      ],
    },
    {
      mobName: 'Lobo Fantasma',
      name: 'Cristal do Lobo Fantasma',
      flavorText: 'Fragmento lunar onde a alcateia ainda uiva — caçar e sentir a alcateia em si.',
      rarity: 'INCOMUM',
      effects: [
        { type: 'STAT_FLAT', stat: 'physicalAtk', value: 6 },
        { type: 'STAT_PERCENT', stat: 'speed', percent: 5 },
      ],
    },
    {
      mobName: 'Feiticeira das Sombras',
      name: 'Cristal da Feiticeira das Sombras',
      flavorText: 'Fragmento lunar mordido pela duvida da feiticeira — a magia que se aprende sozinho.',
      rarity: 'INCOMUM',
      effects: [
        { type: 'STAT_FLAT', stat: 'magicAtk', value: 7 },
        { type: 'STAT_PERCENT', stat: 'magicDef', percent: 5 },
      ],
    },
    // T3 (3) — 2 efeitos com mix
    {
      mobName: 'Cavaleiro Maldito',
      name: 'Cristal do Cavaleiro Maldito',
      flavorText: 'Fragmento lunar tingido de juramento quebrado — a forca que vem da escolha pesada.',
      rarity: 'RARO',
      effects: [
        { type: 'STAT_FLAT', stat: 'physicalAtk', value: 10 },
        { type: 'STAT_PERCENT', stat: 'physicalDef', percent: 8 },
      ],
    },
    {
      mobName: 'Serpente Venenosa',
      name: 'Cristal da Serpente Venenosa',
      flavorText: 'Fragmento lunar com veneno calmo cristalizado — o tempo escapa devagar pelos dedos.',
      rarity: 'RARO',
      effects: [
        { type: 'STAT_FLAT', stat: 'speed', value: 8 },
        { type: 'STAT_PERCENT', stat: 'magicAtk', percent: 7 },
      ],
    },
    {
      mobName: 'Elemental de Fogo',
      name: 'Cristal do Elemental de Fogo',
      flavorText: 'Fragmento lunar preservando uma chama que ama o que toca — calor que nao queima quem o porta.',
      rarity: 'RARO',
      effects: [
        { type: 'STAT_FLAT', stat: 'magicAtk', value: 12 },
        { type: 'STAT_PERCENT', stat: 'magicAtk', percent: 5 },
      ],
    },
    // T4 (2) — 3 efeitos incluindo TRIGGER (inerte na fase 1)
    {
      mobName: 'Dragao Jovem',
      name: 'Cristal do Dragao Jovem',
      flavorText: 'Fragmento lunar com o luto do dragao — furia que so se acende quando ja resta pouco.',
      rarity: 'EPICO',
      effects: [
        { type: 'STAT_FLAT', stat: 'physicalAtk', value: 14 },
        { type: 'STAT_PERCENT', stat: 'hp', percent: 10 },
        {
          type: 'TRIGGER',
          trigger: 'ON_LOW_HP',
          payload: { threshold: 30, effect: { type: 'BUFF', stat: 'physicalAtk', value: 1, duration: 2 } },
        },
      ],
    },
    {
      mobName: 'Lich Anciaa',
      name: 'Cristal da Lich Anciaa',
      flavorText: 'Fragmento lunar tirado do cristal central da Lich — um pedaco de mente que estuda voce de volta.',
      rarity: 'EPICO',
      effects: [
        { type: 'STAT_FLAT', stat: 'magicAtk', value: 16 },
        { type: 'STAT_PERCENT', stat: 'magicDef', percent: 10 },
        {
          type: 'TRIGGER',
          trigger: 'ON_KILL',
          payload: { effect: { type: 'HEAL', percent: 8 } },
        },
      ],
    },
    // T5 (1) — 3 efeitos top com TRIGGER + STATUS_RESIST
    {
      mobName: 'Arauto do Abismo',
      name: 'Cristal do Arauto do Abismo',
      flavorText: 'Fragmento lunar tocado por algo anterior ao mundo — o portador escuta o aviso, e ainda assim avança.',
      rarity: 'LENDARIO',
      effects: [
        { type: 'STAT_FLAT', stat: 'physicalAtk', value: 18 },
        { type: 'STAT_FLAT', stat: 'magicAtk', value: 18 },
        { type: 'STAT_PERCENT', stat: 'hp', percent: 12 },
        {
          type: 'TRIGGER',
          trigger: 'ON_TURN_START',
          payload: { effect: { type: 'BUFF', stat: 'speed', value: 1, duration: 1 } },
        },
        { type: 'STATUS_RESIST', status: 'STUN', percent: 50 },
      ],
    },
  ]

  // dropChance da variante 1 estrela por tier do mob.
  // Tier 1 -> 8% / Tier 2 -> 5% / Tier 3 -> 3% / Tier 4 -> 1.5% / Tier 5 -> 0.5%.
  const dropChanceByTier: Record<number, number> = {
    1: 8,
    2: 5,
    3: 3,
    4: 1.5,
    5: 0.5,
  }

  console.log('Seeding cards...')
  for (const cardData of cards) {
    const mob = await prisma.mob.findUnique({ where: { name: cardData.mobName } })
    if (!mob) {
      console.warn(`  Cristal ignorado — mob "${cardData.mobName}" nao encontrado.`)
      continue
    }
    const dropChance = dropChanceByTier[mob.tier] ?? 5
    await prisma.card.upsert({
      where: { mobId_requiredStars: { mobId: mob.id, requiredStars: 1 } },
      update: {
        name: cardData.name,
        flavorText: cardData.flavorText,
        rarity: cardData.rarity,
        effects: cardData.effects as unknown as Prisma.InputJsonValue,
        dropChance,
        requiredStars: 1,
      },
      create: {
        mobId: mob.id,
        name: cardData.name,
        flavorText: cardData.flavorText,
        rarity: cardData.rarity,
        effects: cardData.effects as unknown as Prisma.InputJsonValue,
        dropChance,
        requiredStars: 1,
      },
    })
  }
  console.log(`  ${cards.length} cards upserted.`)

  // ------------------------------------------------------------
  // Variantes de exemplo — Slime Verdejante (2 estrelas e 3 estrelas)
  // Validacao visual da feature de variantes. Variantes raras sao
  // colecionaveis puros (effects: []), sem bonus de stats — apenas
  // trofeu visual com flavor narrativo. A variante 1 estrela continua
  // sendo a unica que concede stats.
  // ------------------------------------------------------------

  console.log('Seeding card variants (Slime Verdejante 2*/3*)...')
  const variantHostMob = await prisma.mob.findUnique({ where: { name: 'Slime Verdejante' } })
  if (!variantHostMob) {
    console.warn('  Variantes ignoradas — mob "Slime Verdejante" nao encontrado.')
  } else {
    await prisma.card.upsert({
      where: { mobId_requiredStars: { mobId: variantHostMob.id, requiredStars: 2 } },
      create: {
        mobId: variantHostMob.id,
        name: 'Cristal Heroico do Goblin',
        flavorText:
          'Dizem os anciões que o primeiro goblin nasceu da risada de uma raposa que tropeçou numa pedra. Por isso eles riem quando caem — não por dor, mas em homenagem à mãe trapalhona da espécie.',
        rarity: 'RARO',
        requiredStars: 2,
        dropChance: 1.5,
        effects: [] as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: 'Cristal Heroico do Goblin',
        flavorText:
          'Dizem os anciões que o primeiro goblin nasceu da risada de uma raposa que tropeçou numa pedra. Por isso eles riem quando caem — não por dor, mas em homenagem à mãe trapalhona da espécie.',
        rarity: 'RARO',
        dropChance: 1.5,
        effects: [] as unknown as Prisma.InputJsonValue,
      },
    })

    await prisma.card.upsert({
      where: { mobId_requiredStars: { mobId: variantHostMob.id, requiredStars: 3 } },
      create: {
        mobId: variantHostMob.id,
        name: 'Cristal Ancestral do Goblin',
        flavorText:
          'Nas noites sem lua, os clãs goblin se reúnem para trocar pedrinhas brilhantes. Cada pedrinha é uma história — quem acumula mais histórias vira conselheiro. Eles não têm rei: têm o-que-mais-soube-ouvir.',
        rarity: 'LENDARIO',
        requiredStars: 3,
        dropChance: 0.3,
        effects: [] as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: 'Cristal Ancestral do Goblin',
        flavorText:
          'Nas noites sem lua, os clãs goblin se reúnem para trocar pedrinhas brilhantes. Cada pedrinha é uma história — quem acumula mais histórias vira conselheiro. Eles não têm rei: têm o-que-mais-soube-ouvir.',
        rarity: 'LENDARIO',
        dropChance: 0.3,
        effects: [] as unknown as Prisma.InputJsonValue,
      },
    })
    console.log('  2 card variants upserted (2* RARO, 3* LENDARIO).')
  }

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
