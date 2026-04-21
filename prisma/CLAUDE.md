# prisma/ — Schema e Migrations

## Modelos principais

| Model | Descrição |
|---|---|
| `User` | Jogador: id (cuid), email, passwordHash, name, avatarUrl (String?, URL Cloudinary), houseId, createdAt |
| `House` | Casa: Arion, Lycus, Noctis, Nereid |
| `Character` | Atributos do personagem: userId (1-1), physicalAtk, physicalDef, magicAtk, magicDef, hp, speed, level (default 1), currentExp (default 0), freePoints (default 0), bossEssence (default 0) |
| `Habit` | Definição de hábito: name, category (enum), attributeGrants (JSON) |
| `HabitLog` | Registro diário: userId, habitId, completedAt, date (Date-only, meia-noite UTC), attributesGranted (JSON). Constraint unique em `[userId, habitId, date]` |
| `Skill` | Habilidade desbloqueável: name, description, tier, cooldown, target (String — validado na aplicacao com SkillTarget), damageType, basePower, hits, accuracy (Int, default 100 — % base de acerto, 1-100), effects (JSON — SkillEffect[]), mastery (JSON — SkillMastery) |
| `UserHabit` | Relacao N-N entre User e Habit — habitos selecionados no cadastro |
| `CharacterSkill` | Relação N-N entre Character e Skill (equipada ou não) |
| `DailyTask` | Tarefa diária gerada de um hábito: userId, habitId, description, tag (String?, nullable), attributeGrants (JSON), dueDate, completed, completedAt. Constraint unique em `[userId, description, dueDate]` (permite múltiplas tarefas do mesmo hábito no mesmo dia, desde que com descrições diferentes). Índice composto em `[userId, dueDate]` |
| `Battle` | Batalha: player1Id, player2Id, winnerId, status, log (JSON), createdAt |
| `Mob` | Inimigo PvE: name (unique), description, tier (1-5), aiProfile (AGGRESSIVE/DEFENSIVE/TACTICAL/BALANCED), imageUrl (String?, URL Cloudinary da imagem do mob), stats (physicalAtk, physicalDef, magicAtk, magicDef, hp, speed) |
| `MobSkill` | Relacao N-N entre Mob e Skill: mobId, skillId, slotIndex (0-3). Constraints unique em `[mobId, skillId]` e `[mobId, slotIndex]` |
| `PveBattle` | Registro de batalha PvE: userId, mobId, result (VICTORY/DEFEAT/DRAW/null), expGained, turns, log (JSON), mode (PveBattleMode: SOLO/MULTI/COOP_2V3/COOP_2V5, default SOLO), teamMateId (String?, parceiro em coop), mobIds (String[], IDs dos mobs em multi/coop), createdAt |
| `RefreshToken` | Token de refresh persistido: userId, tokenHash (SHA-256, unique), family (UUID para rotacao), revoked, expiresAt. Indices em userId, family e expiresAt. onDelete Cascade com User |
| `Boss` | Chefe cooperativo: name (unique), description, lore, category (HabitCategory), tier (2-4), aiProfile, stats (physicalAtk, physicalDef, magicAtk, magicDef, hp, speed). Stats ~3x de mobs normais por tier |
| `BossSkill` | Relacao N-N entre Boss e Skill: bossId, skillId, slotIndex (0-3). Constraints unique em `[bossId, skillId]` e `[bossId, slotIndex]` |
| `CoopBattle` | Registro de batalha cooperativa: bossId, date (Date), status (MATCHING/etc), result, turns, expGained, log (JSON). Indice em `[date, status]` |
| `CoopBattleParticipant` | Jogador em batalha coop: coopBattleId, userId, dominantCategory (HabitCategory). Constraint unique em `[coopBattleId, userId]` |
| `Friendship` | Relacao de amizade: senderId, receiverId, status (FriendshipStatus enum: PENDING/ACCEPTED/DECLINED/BLOCKED). Constraint unique em `[senderId, receiverId]`. Indice em receiverId. onDelete Cascade em ambas as relacoes |

## Convenções de schema

- Sempre usar `id String @id @default(cuid())` — nunca `Int @default(autoincrement())`.
- Timestamps: `createdAt DateTime @default(now())` e `updatedAt DateTime @updatedAt` em todo model.
- Enums para campos com valores fixos: `HabitCategory`, `BattleStatus`, `HouseName`, `FriendshipStatus`, `PveBattleMode` (SOLO, MULTI, COOP_2V3, COOP_2V5).
- Dados variáveis por registro (atributos concedidos, log de batalha): usar `Json` com tipo TypeScript em `types/`.

## Comandos

```bash
npx prisma migrate dev --name <descricao>   # dev: cria migration + aplica
npx prisma migrate deploy                    # produção: aplica migrations pendentes
npx prisma db seed                           # popula dados iniciais (casas, hábitos base)
npx prisma studio                            # UI visual do banco (dev only)
npx prisma generate                          # regenera o client após mudança de schema
```

## Seed

O arquivo `prisma/seed.ts` popula o banco com dados iniciais. Executar via `npx prisma db seed`.

### Dados populados

- **4 Casas**: ARION (Leao), LYCUS (Lobo), NOCTIS (Coruja), NEREID (Sereia) — upsert por `name`
- **25 Habitos**: categorias amplas distribuidas em 5 grupos — PHYSICAL (5), INTELLECTUAL (6), MENTAL (5), SOCIAL (4), SPIRITUAL (5) — upsert por `name`. Tarefas diarias serao geradas com base nos habitos escolhidos (fase futura).
- **49 Skills**: habilidades de batalha distribuidas em 3 tiers — Tier 1 (23, cooldown 0), Tier 2 (17, cooldown 1), Tier 3 (9, cooldown 2) — upsert por `name`. Skills nao sao vinculadas a casas; qualquer jogador pode desbloquea-las. Cobrem todos os 6 targets (SELF, SINGLE_ALLY, ALL_ALLIES, SINGLE_ENEMY, ALL_ENEMIES, ALL), todos os 12 effect types (BUFF, DEBUFF, STATUS, VULNERABILITY, PRIORITY_SHIFT, COUNTER, HEAL, CLEANSE, RECOIL, SELF_DEBUFF, COMBO, ON_EXPIRE) e todos os 5 status effects (STUN, FROZEN, BURN, POISON, SLOW). Inclui 2 skills COMBO, 2 skills ON_EXPIRE, skills AoE com tradeoffs e skills de suporte para team modes.
- **12 Mobs**: inimigos PvE distribuidos em 5 tiers — Tier 1 (3), Tier 2 (3), Tier 3 (3), Tier 4 (2), Tier 5 (1 boss) — upsert por `name`. Cada mob tem 4 skills (MobSkill com slotIndex 0-3), um perfil de IA (AGGRESSIVE, DEFENSIVE, TACTICAL, BALANCED), stats base e `imageUrl` (URL Cloudinary da imagem). Skills dos mobs sao referenciadas pelo nome exato do seed de skills.
- **10 Bosses**: chefes cooperativos distribuidos em 5 categorias (PHYSICAL, INTELLECTUAL, MENTAL, SOCIAL, SPIRITUAL), 2 por categoria — tiers 2, 3 e 4. Cada boss tem 4 skills (BossSkill com slotIndex 0-3), perfil de IA e stats ~3x de mobs normais. Seed em `prisma/seed-bosses.ts`, executado apos mobs no seed principal.

### Targets validos para Skill.target (String no Prisma)

`SELF`, `SINGLE_ALLY`, `ALL_ALLIES`, `SINGLE_ENEMY`, `ALL_ENEMIES`, `ALL`

Validacao feita na camada de aplicacao via tipo `SkillTarget` em `types/skill.ts`.

### Effect types suportados no JSON effects (SkillEffect[])

`BUFF`, `DEBUFF`, `STATUS`, `VULNERABILITY`, `PRIORITY_SHIFT`, `COUNTER`, `HEAL`, `CLEANSE`, `RECOIL`, `SELF_DEBUFF`, `COMBO`, `ON_EXPIRE`

O efeito COUNTER aceita campo opcional `onTrigger: CounterTriggerPayload[]` com efeitos condicionais (BUFF, DEBUFF, STATUS, VULNERABILITY, HEAL, SELF_DEBUFF) que disparam apenas quando o contra-ataque e ativado.

Tipagem completa: discriminated union `SkillEffect` em `types/skill.ts`.

### Formato do attributeGrants (JSON)

Chaves usadas no JSON: `physicalAttack`, `physicalDefense`, `magicAttack`, `magicDefense`, `hp`, `speed`. Apenas atributos com valor > 0 sao incluidos.

**Nota:** As chaves do JSON diferem dos nomes das colunas do Character (`physicalAtk`, `physicalDef`, etc.). O codigo que aplica os grants deve mapear as chaves JSON para os campos do Prisma.

### Configuracao

O seed e executado via `tsx` (devDependency). A configuracao esta em `package.json`:
```json
"prisma": { "seed": "npx tsx prisma/seed.ts" }
```

### Task Templates

O arquivo `prisma/task-templates.ts` exporta um array tipado `taskTemplates: TaskTemplate[]` com 2-3 variações de tarefa diária para cada um dos 25 hábitos. Cada template contém:
- `habitName` — nome exato do hábito (deve bater com o seed)
- `description` — texto curto da tarefa apresentado ao jogador
- `attributeGrants` — objeto com atributos concedidos ao completar (chaves: `physicalAttack`, `physicalDefense`, `magicAttack`, `magicDefense`, `hp`, `speed`)

A constraint `@@unique([userId, description, dueDate])` no modelo `DailyTask` garante que não existam tarefas com a mesma descrição para o mesmo usuário no mesmo dia. Isso permite múltiplas tarefas do mesmo hábito (com templates/descrições diferentes) quando o jogador tem menos de 5 hábitos. O sistema gera exatamente 5 tarefas diárias por jogador, selecionando aleatoriamente entre os hábitos ativos e repetindo hábitos se necessário.

### Proximos passos

- Implementar o serviço de geração diária de DailyTasks (cron ou on-demand).
- Implementar lógica de desbloqueio de skills por porcentagem de hábitos (Fase 4).

## Regras

- Nunca editar arquivos dentro de `prisma/migrations/` manualmente.
- Nunca rodar `migrate dev` em produção — usar `migrate deploy`.
- Após qualquer mudança no schema, rodar `prisma generate` antes de buildar.
