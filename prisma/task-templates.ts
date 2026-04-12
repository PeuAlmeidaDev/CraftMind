// ============================================================
// Task Templates — tarefas diárias possíveis para cada hábito
// Cada hábito possui 2-3 variações de tarefa com atributos
// concedidos baseados na categoria do hábito.
//
// Regras de atributo por categoria (GDD):
//   PHYSICAL:     physicalAttack (1-3) + physicalDefense (1-2) + hp (0-2)
//   INTELLECTUAL: magicAttack (2-3)
//   MENTAL:       magicDefense (1-3) + speed (1-2)
//   SOCIAL:       magicDefense (1) + speed (1)
//   SPIRITUAL:    magicDefense (1-2) + hp (1-2)
// ============================================================

interface AttributeGrants {
  physicalAttack?: number
  physicalDefense?: number
  magicAttack?: number
  magicDefense?: number
  hp?: number
  speed?: number
}

export interface TaskTemplate {
  habitName: string
  description: string
  tag: string
  attributeGrants: AttributeGrants
}

export const taskTemplates: TaskTemplate[] = [
  // ==================== PHYSICAL (5 hábitos) ====================

  // Exercicio Fisico
  {
    habitName: 'Exercicio Fisico',
    description: 'Faca 3 series de flexoes',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 3, physicalDefense: 1 },
  },
  {
    habitName: 'Exercicio Fisico',
    description: 'Faca 3 series de abdominais',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 2, physicalDefense: 2 },
  },
  {
    habitName: 'Exercicio Fisico',
    description: 'Faca 20 minutos de treino funcional em casa',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 2, physicalDefense: 1, hp: 1 },
  },

  // Yoga
  {
    habitName: 'Yoga',
    description: 'Pratique 20 minutos de yoga (saudacao ao sol)',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 1, physicalDefense: 2, hp: 1 },
  },
  {
    habitName: 'Yoga',
    description: 'Faca uma sessao de 15 minutos de yoga restaurativa',
    tag: 'PRACTICE',
    attributeGrants: { physicalDefense: 2, hp: 2 },
  },
  {
    habitName: 'Yoga',
    description: 'Pratique 10 posturas de equilibrio por 15 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 2, physicalDefense: 1 },
  },

  // Artes Marciais
  {
    habitName: 'Artes Marciais',
    description: 'Pratique shadow boxing por 15 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 3, physicalDefense: 1 },
  },
  {
    habitName: 'Artes Marciais',
    description: 'Treine katas ou formas por 20 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 2, physicalDefense: 2 },
  },
  {
    habitName: 'Artes Marciais',
    description: 'Faca 15 minutos de treino de chutes e socos no ar',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 3, hp: 1 },
  },

  // Alongamento
  {
    habitName: 'Alongamento',
    description: 'Faca 15 minutos de alongamento completo',
    tag: 'PRACTICE',
    attributeGrants: { physicalDefense: 2, hp: 1 },
  },
  {
    habitName: 'Alongamento',
    description: 'Alongue pernas e quadril por 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 1, physicalDefense: 1, hp: 1 },
  },
  {
    habitName: 'Alongamento',
    description: 'Faca alongamento de coluna e ombros por 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalDefense: 2, hp: 2 },
  },

  // Danca
  {
    habitName: 'Danca',
    description: 'Dance livremente por 20 minutos',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 2, physicalDefense: 1, hp: 1 },
  },
  {
    habitName: 'Danca',
    description: 'Pratique uma coreografia por 15 minutos',
    tag: 'APPLY',
    attributeGrants: { physicalAttack: 2, physicalDefense: 2 },
  },
  {
    habitName: 'Danca',
    description: 'Faca 15 minutos de danca aerobica em casa',
    tag: 'PRACTICE',
    attributeGrants: { physicalAttack: 3, hp: 1 },
  },

  // ==================== INTELLECTUAL (6 hábitos) ====================

  // Leitura
  {
    habitName: 'Leitura',
    description: 'Leia por 30 minutos',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Leitura',
    description: 'Leia um capitulo de um livro e faca anotacoes',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 3 },
  },
  {
    habitName: 'Leitura',
    description: 'Leia por 20 minutos e resuma o que aprendeu',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },

  // Estudos Academicos
  {
    habitName: 'Estudos Academicos',
    description: 'Estude por 45 minutos com foco total',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 3 },
  },
  {
    habitName: 'Estudos Academicos',
    description: 'Revise anotacoes ou flashcards por 30 minutos',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Estudos Academicos',
    description: 'Assista uma aula ou video educacional e faca resumo',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 3 },
  },

  // Programacao
  {
    habitName: 'Programacao',
    description: 'Resolva um desafio de logica ou algoritmo',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 3 },
  },
  {
    habitName: 'Programacao',
    description: 'Code por 30 minutos em um projeto pessoal',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Programacao',
    description: 'Estude um conceito novo de programacao por 20 minutos',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },

  // Idiomas
  {
    habitName: 'Idiomas',
    description: 'Pratique vocabulario por 20 minutos',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Idiomas',
    description: 'Faca uma licao completa no app de idiomas',
    tag: 'LEARN',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Idiomas',
    description: 'Escreva um paragrafo curto no idioma que esta aprendendo',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 3 },
  },

  // Escrita Criativa
  {
    habitName: 'Escrita Criativa',
    description: 'Escreva livremente por 20 minutos',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Escrita Criativa',
    description: 'Escreva um conto curto ou poema',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 3 },
  },
  {
    habitName: 'Escrita Criativa',
    description: 'Faca um exercicio de escrita criativa com prompt',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 2 },
  },

  // Xadrez e Puzzles
  {
    habitName: 'Xadrez e Puzzles',
    description: 'Jogue uma partida de xadrez online',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 3 },
  },
  {
    habitName: 'Xadrez e Puzzles',
    description: 'Resolva 5 puzzles de xadrez ou logica',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 2 },
  },
  {
    habitName: 'Xadrez e Puzzles',
    description: 'Faca um sudoku ou palavras cruzadas',
    tag: 'APPLY',
    attributeGrants: { magicAttack: 2 },
  },

  // ==================== MENTAL (5 hábitos) ====================

  // Meditacao
  {
    habitName: 'Meditacao',
    description: 'Medite por 15 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Meditacao',
    description: 'Faca uma meditacao guiada de 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Meditacao',
    description: 'Pratique meditacao mindfulness por 20 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 3, speed: 1 },
  },

  // Journaling
  {
    habitName: 'Journaling',
    description: 'Escreva no diario por 15 minutos',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Journaling',
    description: 'Registre 3 reflexoes sobre o seu dia',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, speed: 2 },
  },
  {
    habitName: 'Journaling',
    description: 'Responda a uma pergunta de autoconhecimento no diario',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },

  // Respiracao
  {
    habitName: 'Respiracao',
    description: 'Pratique respiracao 4-7-8 por 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Respiracao',
    description: 'Faca 5 minutos de respiracao diafragmatica',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },
  {
    habitName: 'Respiracao',
    description: 'Pratique respiracao box breathing por 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 3, speed: 1 },
  },

  // Digital Detox
  {
    habitName: 'Digital Detox',
    description: 'Fique 1 hora longe do celular e computador',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 2 },
  },
  {
    habitName: 'Digital Detox',
    description: 'Faca 30 minutos de atividade offline (sem telas)',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Digital Detox',
    description: 'Desative notificacoes e fique 2 horas sem redes sociais',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 3, speed: 1 },
  },

  // Planejamento do Dia
  {
    habitName: 'Planejamento do Dia',
    description: 'Planeje suas 3 prioridades do dia',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, speed: 2 },
  },
  {
    habitName: 'Planejamento do Dia',
    description: 'Organize sua agenda e defina metas para hoje',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 1 },
  },
  {
    habitName: 'Planejamento do Dia',
    description: 'Revise as metas da semana e ajuste o plano de hoje',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, speed: 2 },
  },

  // ==================== SOCIAL (4 hábitos) ====================

  // Voluntariado
  {
    habitName: 'Voluntariado',
    description: 'Dedique 30 minutos a uma causa online ou comunidade',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },
  {
    habitName: 'Voluntariado',
    description: 'Ajude alguem com uma tarefa ou problema hoje',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },

  // Mentoria
  {
    habitName: 'Mentoria',
    description: 'Compartilhe um conselho ou experiencia com alguem',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },
  {
    habitName: 'Mentoria',
    description: 'Ajude alguem a resolver um problema ou duvida',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },

  // Manter Contato
  {
    habitName: 'Manter Contato',
    description: 'Ligue ou mande mensagem para alguem que nao fala ha tempo',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },
  {
    habitName: 'Manter Contato',
    description: 'Tenha uma conversa significativa com amigo ou familiar',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },

  // Ensinar Algo
  {
    habitName: 'Ensinar Algo',
    description: 'Ensine um conceito ou habilidade para alguem',
    tag: 'APPLY',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },
  {
    habitName: 'Ensinar Algo',
    description: 'Crie uma explicacao simples sobre algo que voce domina',
    tag: 'APPLY',
    attributeGrants: { magicDefense: 1, speed: 1 },
  },

  // ==================== SPIRITUAL (5 hábitos) ====================

  // Oracao
  {
    habitName: 'Oracao',
    description: 'Faca uma oracao de 10 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 2, hp: 1 },
  },
  {
    habitName: 'Oracao',
    description: 'Reserve um momento de prece e conexao espiritual',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 1, hp: 2 },
  },

  // Gratidao
  {
    habitName: 'Gratidao',
    description: 'Escreva 3 coisas pelas quais voce e grato hoje',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, hp: 2 },
  },
  {
    habitName: 'Gratidao',
    description: 'Agradeca alguem (presencialmente ou por mensagem)',
    tag: 'CONNECT',
    attributeGrants: { magicDefense: 2, hp: 1 },
  },
  {
    habitName: 'Gratidao',
    description: 'Reflita por 5 minutos sobre momentos positivos do dia',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, hp: 1 },
  },

  // Contemplacao
  {
    habitName: 'Contemplacao',
    description: 'Dedique 15 minutos a reflexao profunda e silenciosa',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, hp: 2 },
  },
  {
    habitName: 'Contemplacao',
    description: 'Observe a natureza ou o ambiente ao redor por 10 minutos',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, hp: 2 },
  },

  // Leitura Filosofica
  {
    habitName: 'Leitura Filosofica',
    description: 'Leia um texto filosofico ou reflexivo por 20 minutos',
    tag: 'LEARN',
    attributeGrants: { magicDefense: 2, hp: 1 },
  },
  {
    habitName: 'Leitura Filosofica',
    description: 'Leia e reflita sobre um trecho de sabedoria',
    tag: 'LEARN',
    attributeGrants: { magicDefense: 1, hp: 2 },
  },
  {
    habitName: 'Leitura Filosofica',
    description: 'Estude uma passagem filosofica e anote suas reflexoes',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 2, hp: 2 },
  },

  // Silencio Intencional
  {
    habitName: 'Silencio Intencional',
    description: 'Fique em silencio intencional por 15 minutos',
    tag: 'PRACTICE',
    attributeGrants: { magicDefense: 2, hp: 1 },
  },
  {
    habitName: 'Silencio Intencional',
    description: 'Pratique 10 minutos de silencio e introspecao',
    tag: 'REFLECT',
    attributeGrants: { magicDefense: 1, hp: 2 },
  },
]
