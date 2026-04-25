# Coop PvE 3v5 — Design Spec

## Visao geral

Novo modo "3v5" adicionado ao sistema coop-pve existente. 3 jogadores enfrentam 5 mobs com stats escalados. Reutiliza toda a infra de matchmaking, convites, Socket.io e engine — mudancas pontuais para suportar 3 players e balancear mobs.

## Escopo

- Adicionar modo "3v5" ao sistema coop-pve
- NAO criar nova rota/pagina/engine — estender os arquivos existentes
- NAO alterar comportamento dos modos "2v3" e "2v5"

---

## 1. Tipos

**Arquivo:** `lib/battle/coop-pve-types.ts`

```typescript
// ANTES
export type CoopPveMode = "2v3" | "2v5";

// DEPOIS
export type CoopPveMode = "2v3" | "2v5" | "3v5";
```

Nenhuma mudanca estrutural nos tipos restantes. `team: PlayerState[]` e `mobs: MobState[]` ja sao arrays genericos.

---

## 2. Engine

**Arquivo:** `lib/battle/coop-pve-turn.ts`

### initCoopPveBattle

Validacao de team size dinamica por modo:

```
expectedPlayers = mode === "3v5" ? 3 : 2
expectedMobs    = mode === "2v3" ? 3 : 5   // 2v5 e 3v5 ambos usam 5 mobs
```

### resolveCoopPveTurn

- Validacao de acoes: N acoes = N players vivos (ja funciona com array generico)
- Ordem de resolucao: players por speed DESC, depois mobs por speed DESC com desempate por index (sem mudanca)
- Derrota: `team.every(p => p.currentHp <= 0)` — funciona para 2 ou 3 players
- Vitoria: `mobs.every(m => m.defeated)` — sem mudanca

### Mob stat scaling para 3v5

Antes de passar a engine, os stats dos mobs sao multiplicados:

| Stat | Multiplicador |
|------|--------------|
| hp (baseStats.hp) | x1.40 (+40%) |
| physicalAtk | x1.25 (+25%) |
| magicAtk | x1.25 (+25%) |
| physicalDef | sem mudanca |
| magicDef | sem mudanca |
| speed | sem mudanca |

Aplicado no matchmaking/invite ao montar `CoopPveMobConfig[]`, ANTES de chamar `initCoopPveBattle`. A engine recebe stats ja escalados — sem logica especial na engine.

---

## 3. Matchmaking (fila)

**Arquivo:** `server/handlers/coop-pve-matchmaking.ts`

### Fila

- `VALID_MODES` inclui `"3v5"`
- Fila por modo: Map<CoopPveMode, QueueEntry[]>
- `findCoopPveMatch("3v5")` retorna 3 players (splice 0,3) ou null

### Match found

- Emitir `coop-pve:match:found` para 3 sockets com info dos 2 teammates
- Accept: 3 players precisam aceitar dentro do timeout (30s)
- `coop-pve:match:accepted` emite { accepted: N, total: 3 }
- Se qualquer player recusar ou timeout: cancelar match, devolver outros a fila

### Criacao da batalha (apos accept)

- Buscar characters de 3 players
- Calcular tier: `Math.ceil(avgLevel / 10)` com media de 3
- Selecionar 5 mobs do tier (mesma logica do 2v5)
- Aplicar multiplicadores de stat nos mobs para 3v5
- Chamar `initCoopPveBattle` com team de 3

---

## 4. Convites

**Arquivo:** `server/handlers/coop-pve-invite.ts`

### Fluxo para 3v5

1. Lider envia convite 1: `coop-pve:invite:send { targetUserId: amigo1, mode: "3v5" }`
2. Sistema cria invite com `senderId`, `targetUserId: amigo1`, `mode: "3v5"`, `groupId` (novo campo)
3. Lider envia convite 2: `coop-pve:invite:send { targetUserId: amigo2, mode: "3v5" }`
4. Sistema cria segundo invite com mesmo `groupId`
5. Quando ambos aceitam: batalha inicia com 3 players (lider + 2 convidados)
6. Se um recusar: o outro convite e cancelado, lider recebe notificacao

### Novo campo no invite store

```typescript
type CoopPveInvite = {
  id: string;
  senderId: string;
  targetUserId: string;
  mode: CoopPveMode;
  groupId: string;      // NOVO: agrupa convites do mesmo lider para 3v5
  createdAt: number;
};
```

Para modos 2v3/2v5, `groupId` e igual ao `id` (1 convite = 1 grupo). Para 3v5, dois convites compartilham o mesmo `groupId`.

### Logica de aceitacao

- Ao aceitar um convite de grupo 3v5: verificar se TODOS os convites do `groupId` foram aceitos
- Se sim: iniciar batalha
- Se nao: aguardar (ou timeout)
- TTL do convite: 30s (mantido)

---

## 5. Battle handler (Socket.io)

**Arquivo:** `server/handlers/coop-pve-battle.ts`

### Turn timer

- Espera acoes de N players vivos (nao hardcoded 2)
- `pendingActions.size >= alivePlayerCount` → resolve turno
- Timeout 30s: players sem acao recebem skip

### Broadcast

- State emitido para 3 sockets via `playerSockets` map (ja e por userId, escala sem mudanca)
- Eventos: `coop-pve:battle:state`, `coop-pve:battle:end`, `coop-pve:action:received`

### Reconexao

- Funciona igual (por userId): player reconecta, recebe state atual, retoma
- Grace period por player individual (30s) — sem mudanca

### Persistencia

- Criar 3 registros `PveBattle` (1 por player) em vez de 2
- EXP por player: `floor((totalMobExp * 1.25) / 3)`

---

## 6. Frontend

**Arquivo:** `app/(game)/coop-pve/page.tsx` + componentes

### Modo selector

- Adicionar terceira aba/botao "3v5" ao lado de "2v3" e "2v5"
- Visual: 3 dots aliados vs 5 dots inimigos (FormationIcon)

### Match found modal

- Mostrar 3 slots de squad (em vez de 2)
- 3 precisam aceitar para iniciar

### Arena (CoopPveArena)

- Team panel: renderizar 3 player cards (flex wrap ou grid 3 cols)
- Mob row: 5 mobs (igual ao 2v5 — ja suportado)
- Skill targeting SINGLE_ALLY: mostrar 2 aliados clicaveis (em vez de 1)

### Convites

- Para modo 3v5: apos enviar primeiro convite, mostrar opcao de convidar segundo amigo
- Status de convites pendentes: mostrar qual amigo ja aceitou

---

## 7. EXP e recompensas

| Modo | Mobs | EXP formula |
|------|------|-------------|
| 2v3 | 3 normais | floor(totalMobExp * 1.25 / 2) |
| 2v5 | 5 normais | floor(totalMobExp * 1.25 / 2) |
| 3v5 | 5 escalados (+40% HP, +25% atk) | floor(totalMobExp * 1.25 / 3) |

Nota: `totalMobExp` e calculado dos baseStats dos mobs (ja escalados), entao naturalmente gera mais EXP que o 2v5 (mobs mais fortes = mais EXP base).

---

## 8. Validacao e seguranca

- Mode "3v5" validado em todos os entry points (queue join, invite send)
- Team size validado na engine (3 para 3v5, 2 para outros)
- Mob count validado na engine (5 para 3v5 e 2v5, 3 para 2v3)
- Actions por turno validadas contra players vivos
- Nenhum novo endpoint de API necessario — tudo via Socket.io existente

---

## 9. O que NAO muda

- Modos 2v3 e 2v5 continuam identicos
- Engine de combate (damage, effects, AI, status) nao muda
- SkillVfx, BattleLog, MobPlaceholder nao mudam
- Historico de batalha API (`/api/battle/coop-pve/history`) nao muda (ja filtra por userId)
- Sistema de boss fight (3v1) nao e afetado
