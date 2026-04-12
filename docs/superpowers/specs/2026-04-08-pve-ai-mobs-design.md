
# PvE: IA Adaptativa e Definicao de Mobs

## Contexto

A combat engine (lib/battle/) esta pronta para batalhas 1v1. O proximo passo e implementar PvE — jogador contra mobs controlados pelo computador. O objetivo e criar um loop de progressao onde o jogador perde, cumpre habitos na vida real para ficar mais forte, e volta para vencer.

## Decisoes tomadas

- 1v1 PvE primeiro (jogador vs 1 mob). 1v3/1v5 fica para o futuro.
- Mobs com stats FIXOS organizados em tiers de dificuldade.
- IA adaptativa que analisa o estado da batalha para escolher skills.
- Skills dos mobs: pool global das 49 existentes + algumas exclusivas de mob.
- Mobs armazenados no banco (tabela Prisma) com seed para dados iniciais.
- Recompensa por vitoria sera EXP/level (implementado separadamente, nao nesta spec).
- Nenhuma batalha e impossivel — sempre desafiadora mas vencivel com boa estrategia.

## 1. Modelo de Mob (Prisma)

Nova tabela `Mob` no schema:

```prisma
model Mob {
  id          String @id @default(cuid())
  name        String @unique
  description String
  tier        Int             // 1-5
  aiProfile   String          // "AGGRESSIVE" | "DEFENSIVE" | "TACTICAL" | "BALANCED"

  // Stats fixos
  physicalAtk Int
  physicalDef Int
  magicAtk    Int
  magicDef    Int
  hp          Int
  speed       Int

  // Skills equipadas (relacao N-N)
  skills MobSkill[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MobSkill {
  id        String @id @default(cuid())
  mobId     String
  skillId   String
  slotIndex Int    // 0-3

  mob   Mob   @relation(fields: [mobId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id])

  @@unique([mobId, skillId])
  @@unique([mobId, slotIndex])
}
```

## 2. Tiers de dificuldade

Stats fixos por tier. O jogador comeca com stats base 10 e sobe ~2-5 pontos por dia cumprindo habitos.

| Tier | Faixa de stats | Skills permitidas | Perfil tipico |
|---|---|---|---|
| 1 | 10-15 | Tier 1 | Desafiador para jogador iniciante |
| 2 | 20-30 | Tier 1-2 | Alguns dias de habitos |
| 3 | 35-50 | Tier 1-2 | Jogador intermediario |
| 4 | 55-75 | Tier 1-3 | Jogador avancado |
| 5 | 80-100+ | Tier 2-3 + exclusivas | Boss, desafio maximo |

## 3. Sistema de IA (scoring adaptativo)

### Fluxo por turno

1. Listar skills disponiveis (nao em cooldown)
2. Para cada skill, calcular score baseado no estado da batalha
3. Aplicar modificador do perfil de IA
4. Adicionar ruido aleatorio de +-15%
5. Escolher skill com maior score final

### Regras de scoring

Cada skill comeca com um score base proporcional ao seu poder:
- Skills de dano: basePower / 10
- Skills de suporte (HEAL, BUFF, CLEANSE, COUNTER): 5

Bonus contextuais somados ao score base:

| Condicao | Bonus | Aplicavel a |
|---|---|---|
| HP do mob < 30% | +50 | Skills com efeito HEAL |
| HP do mob < 50% | +25 | Skills com efeito HEAL |
| HP do oponente > 70% | +30 | Skills de dano alto (basePower >= 60) |
| Oponente sem debuffs ativos | +25 | Skills com efeito DEBUFF ou STATUS |
| Mob sem buffs ativos | +20 | Skills com efeito BUFF |
| Oponente tem VULNERABILITY matching | +35 | Skills cujo damageType bate com a vulnerabilidade |
| Combo ativo na skill | +15 por stack | Skills com efeito COMBO |
| Oponente com HP < 20% | +40 | Skills de dano (finalizar) |
| Mob esta com status negativo | +30 | Skills com efeito CLEANSE |
| Oponente sem counter ativo | +15 | Skills de dano |

### Perfis de IA

Modificadores aplicados sobre o score calculado:

| Perfil | Dano | Cura/Buff | Debuff/Status | Descricao |
|---|---|---|---|---|
| AGGRESSIVE | x1.5 | x0.7 | x0.8 | Prioriza dano acima de tudo |
| DEFENSIVE | x0.7 | x1.5 | x0.9 | Prioriza sobrevivencia |
| TACTICAL | x0.9 | x0.9 | x1.5 | Prioriza controle e debilitacao |
| BALANCED | x1.0 | x1.0 | x1.0 | Sem modificador, joga pelo score puro |

Classificacao de skills para aplicar o modificador:
- Dano: skills com basePower > 0 e damageType !== "NONE"
- Cura/Buff: skills com efeitos HEAL, BUFF, CLEANSE, COUNTER
- Debuff/Status: skills com efeitos DEBUFF, STATUS, VULNERABILITY

Skills com multiplos tipos recebem a MAIOR das categorias.

### Ruido aleatorio

Score final = score * (1 + noise), onde noise e um valor entre -0.15 e +0.15.
Isso impede que o mob seja 100% previsivel.

## 4. Estrutura de arquivos

```
lib/battle/
  ai.ts           -- chooseAction(): recebe BattleState + playerId do mob, retorna TurnAction
  ai-scoring.ts   -- scoreSkill(): calcula score de uma skill dado o estado
  ai-profiles.ts  -- constantes dos perfis (multiplicadores)
```

### Funcoes

```ts
// ai-profiles.ts
type AiProfile = "AGGRESSIVE" | "DEFENSIVE" | "TACTICAL" | "BALANCED"
type ProfileModifiers = { damage: number; support: number; control: number }
AI_PROFILES: Record<AiProfile, ProfileModifiers>

// ai-scoring.ts
scoreSkill(params: {
  skill: Skill
  mob: PlayerState
  opponent: PlayerState
  profile: AiProfile
  comboState: ComboState
}): number

// ai.ts
chooseAction(params: {
  state: BattleState
  mobPlayerId: string
  profile: AiProfile
  randomFn?: () => number
}): TurnAction
```

## 5. Integracao com a engine existente

A engine nao muda. O mob e tratado como um PlayerState normal:

1. Carregar Mob do banco (stats + skills)
2. Converter para BattlePlayerConfig (mesmo formato de um jogador)
3. Chamar initBattle() normalmente
4. A cada turno: jogador envia acao, servidor chama chooseAction() para o mob
5. Chamar resolveTurn() com as duas acoes
6. Repetir ate fim da batalha

O PvE nao precisa de selecao simultanea (nao ha segundo jogador esperando). O fluxo e:
1. Jogador escolhe skill
2. Servidor gera acao do mob via IA
3. Resolve turno
4. Retorna resultado

## 6. Seed de mobs iniciais

Criar 10-15 mobs iniciais distribuidos nos 5 tiers, usando skills existentes:

- Tier 1 (3 mobs): stats 10-15, skills Tier 1, perfis variados
- Tier 2 (3 mobs): stats 20-30, skills Tier 1-2
- Tier 3 (3 mobs): stats 35-50, skills Tier 1-2
- Tier 4 (2-3 mobs): stats 55-75, skills Tier 1-3
- Tier 5 (1-2 mobs): stats 80-100+, skills Tier 2-3, "bosses"

Cada mob tem nome tematico, 4 skills equipadas, e perfil de IA definido.

## 7. Fora do escopo desta spec

- Sistema de EXP/level (proxima spec)
- PvE 1v3 e 1v5 (requer mudar engine para N jogadores)
- Skills exclusivas de mob (pode ser adicionado depois no banco)
- API routes para listar/iniciar batalhas PvE
- Frontend
- Socket.io para PvE (pode ser HTTP simples ja que nao ha segundo jogador)
