# Boss Fight Cooperativo — Frontend Design Spec

## Contexto

O backend do Boss Fight Cooperativo está implementado (engine, matchmaking Socket.io, APIs). Este spec cobre o frontend: botão no dashboard, fila persistente entre páginas, dropdown de jogadores, modal de match e tela de batalha cooperativa.

O frontend atual do Craft Mind NÃO usa Socket.io — o PvE usa HTTP polling. Este será o primeiro uso de Socket.io no client.

---

## 1. Visão Geral do Fluxo

```
Dashboard (5/5 tasks) → Botão "Boss Fighting"
  → Entra na fila Socket.io
  → Barra inferior flutuante aparece (persiste entre páginas)
  → Jogador pode navegar livremente (dashboard, battle, character)
  → Barra mostra timer, contagem, botões "Ver Jogadores" e "Sair"
  → "Ver Jogadores": dropdown com feed de atividade da categoria
  → Match encontrado: modal global sobre qualquer tela
  → Aceitar: redireciona para /boss-fight (tela de batalha)
  → Batalha cooperativa 3v1 em tempo real
  → Resultado: modal de vitória/derrota com recompensas
```

---

## 2. Hook Socket.io Global

### `useBossQueue` — hook + context provider

Primeira integração Socket.io no client. Gerencia conexão, fila e eventos de match.

**Responsabilidades:**
- Conectar ao Socket.io com JWT do localStorage no handshake
- Gerenciar estado da fila (inQueue, position, queueSize, timer 5min)
- Receber evento `boss:match:found` → mostrar modal
- Gerenciar aceite/recusa do match
- Manter conexão entre navegações de página

**Provider:** Montado no layout do jogo `app/(game)/layout.tsx` — envolve todas as páginas do jogo.

**Estado exportado:**
```typescript
type BossQueueState = {
  // Fila
  inQueue: boolean;
  queueCategory: HabitCategory | null;
  queuePosition: number;
  queueSize: number;
  queueTimeRemaining: number; // segundos restantes dos 5min

  // Match
  matchFound: boolean;
  matchData: {
    battleId: string;
    boss: { id: string; name: string; description: string; tier: number; category: string };
    teammates: { name: string; level: number }[];
    acceptTimeoutMs: number;
  } | null;
  matchAcceptTimeRemaining: number;

  // Ações
  joinQueue: (category: HabitCategory) => void;
  leaveQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
};
```

**Timers no client:**
- Timer de 5min da fila: countdown local (sincronizado pelo servidor via `boss:queue:timeout`)
- Timer de 30s do match: countdown local (sincronizado pelo servidor)

---

## 3. Botão "Boss Fighting" no Dashboard

### Localização
No dashboard, quando o jogador completou 5/5 tasks diárias.

### Comportamento
- Chamar `GET /api/battle/coop/eligible` ao carregar o dashboard
- Se `eligible: true`: mostrar card destacado com gradiente roxo
  - Texto: "Boss Fight Disponível!"
  - Subtexto: "Enfrente um boss com outros jogadores"
  - Botão: "Entrar na Fila"
  - Ao clicar: chamar `joinQueue(dominantCategory)` do hook
- Se `eligible: false` (reason: `incomplete_tasks`): não mostrar o card
- Se `eligible: false` (reason: `already_participated`): mostrar card cinza "Já participou hoje"

---

## 4. Barra Inferior Flutuante (Queue Bar)

### Componente: `BossQueueBar`

Renderizado no layout do jogo (`app/(game)/layout.tsx`). Aparece quando `inQueue === true`.

### Layout
- Position: fixed, bottom 0, full width com padding lateral
- Background: gradiente escuro com borda roxa, sombra roxa
- Altura: ~48px

### Conteúdo
- **Esquerda:**
  - Indicador pulsante roxo (dot animado)
  - "Boss Fight — Procurando..."
  - Subtexto: "{category} | {queueSize}/3 jogadores | {timer}"
- **Direita:**
  - Botão "Ver Jogadores ▲" (toggle dropdown)
  - Botão "Sair" (vermelho, chama `leaveQueue()`)

### Persistência entre páginas
Como o hook `useBossQueue` está no layout, a barra persiste ao navegar entre /dashboard, /battle, /character.

---

## 5. Dropdown "Ver Jogadores"

### Componente: `BossQueuePlayersDropdown`

Abre acima da barra inferior ao clicar "Ver Jogadores".

### Dados
Nova API necessária: `GET /api/battle/coop/category-players?category=INTELLECTUAL`

Retorna jogadores que completaram todas as 5 tasks hoje com a mesma categoria dominante:
```typescript
{
  players: {
    name: string;
    level: number;
    houseName: HouseName;
    tasks: { description: string; category: HabitCategory }[];
    unlockedSkillName: string | null; // nome da skill desbloqueada hoje, se houver
  }[];
  totalCount: number;
}
```

### Layout por jogador
- **Header:** Nome + Level + Casa
- **Tags de tarefas:** chips coloridos
  - Azul: tarefas da categoria dominante
  - Cinza: tarefas de outras categorias
- **Skill desbloqueada:** "Desbloqueou: {nome}" em dourado/laranja. Se não desbloqueou: "Nenhuma skill desbloqueada" em cinza
- Scrollável se muitos jogadores

### Comportamento
- Fecha ao clicar X, clicar no botão "Ver Jogadores" de novo, ou clicar fora
- Dados carregados on-demand ao abrir (com cache de 30s)

---

## 6. Modal de Match Encontrado

### Componente: `BossMatchModal`

Modal global renderizado no layout do jogo. Aparece quando `matchFound === true`.

### Layout
- Overlay: `bg-black/70`, fixed, z-50
- Modal: centralizado, borda roxa, fundo escuro
- **Conteúdo:**
  - "Match Encontrado!" em verde
  - Card do boss: nome, tier, categoria, lore (1 linha)
  - 3 cards dos jogadores: nome, level
  - Timer countdown: "Aceitar em: {seconds}s"
  - Botões: "Aceitar" (verde) + "Recusar" (vermelho)

### Comportamento
- Aceitar: chama `acceptMatch()`, redireciona para `/boss-fight?battleId={id}` quando batalha iniciar
- Recusar: chama `declineMatch()`, fecha modal
- Timer expira: fecha modal automaticamente
- Aparece sobre QUALQUER página (dashboard, battle, character)

---

## 7. Tela de Batalha — `/boss-fight`

### Page: `app/(game)/boss-fight/page.tsx`

Client component. Conecta ao Socket.io para receber eventos de batalha em tempo real.

### Layout: Arena Centralizada (Opção C aprovada)

**Header:**
- Turno atual / MAX_TURNS
- Timer do turno (30s countdown)

**Centro-topo — Boss:**
- Card grande centralizado com borda vermelha
- Nome, tier, categoria
- HP bar (vermelha)
- Status effects (badges pulsantes)

**Centro — Time (3 players):**
- 3 cards horizontais lado a lado
- Cada card: nome, HP bar (verde), status effects
- Card do player local: borda verde mais grossa
- Player morto: opacidade 0.4, "Morto" em vermelho
- Indicador "Agiu" / "Pensando..." por player

**Base — Skills + Log:**
- Esquerda: grid 2x2 de skills (reutilizar padrão do SkillBar existente)
  - Cooldown overlay
  - Click para selecionar
  - Skills de SINGLE_ALLY: ao clicar, mostrar seletor de aliado
- Direita: battle log scrollável (reutilizar padrão do BattleLog existente)

### Componentes reutilizados do PvE
- `StatusParticles.tsx` — efeitos visuais de status (BURN, FROZEN, etc.)
- `AttackEffect.tsx` — slash visual no hit
- `BattleLog.tsx` — feed de eventos (adaptar para nomes de 3 players + boss)

### Componentes novos
- `CoopBattleArena.tsx` — layout principal da arena coop
- `BossCard.tsx` — card do boss (nome, HP, status, visual)
- `TeamPanel.tsx` — 3 cards dos players do time
- `CoopSkillBar.tsx` — skills com suporte a target SINGLE_ALLY (seletor de aliado)
- `AllyTargetSelector.tsx` — dropdown/modal para escolher qual aliado buffar
- `CoopBattleResult.tsx` — modal de resultado com EXP + Essência de Boss
- `TurnTimer.tsx` — countdown visual do turno (30s)

### Fluxo de turno
1. Turno começa → timer de 30s inicia
2. Player escolhe skill (+ alvo se SINGLE_ALLY)
3. Ação enviada via `boss:action`
4. Indicador muda para "Agiu" no card do player
5. Aguarda outros players (ou timer expirar)
6. `boss:turn:result` chega → animar dano, status, mortes
7. Próximo turno (ou resultado final)

### Resultado
- Modal overlay com:
  - "VITÓRIA!" (verde) ou "DERROTA" (vermelho)
  - EXP ganho
  - Essência de Boss ganho (+1 se vitória)
  - Level up se aplicável
  - Botão "Voltar ao Dashboard"

---

## 8. API Nova Necessária

### `GET /api/battle/coop/category-players`

Query param: `category` (HabitCategory)

Retorna jogadores que completaram todas as 5 tasks hoje com a mesma categoria dominante.

**Dados por jogador:**
- `name` — do User
- `level` — do Character
- `houseName` — do User.house
- `tasks[]` — DailyTasks do dia (description + habit.category)
- `unlockedSkillName` — nome da skill desbloqueada hoje (via CharacterSkill criado hoje), ou null

**Restrição:** Apenas jogadores do mesmo dia, mesma categoria dominante. Máximo 20 resultados.

---

## 9. Estrutura de Arquivos

```
app/(game)/
├── layout.tsx                              // + BossQueueProvider + BossQueueBar + BossMatchModal
├── _hooks/
│   └── useBossQueue.ts                     // Hook + context Socket.io para fila
├── _components/
│   ├── BossQueueBar.tsx                    // Barra inferior flutuante
│   ├── BossQueuePlayersDropdown.tsx        // Dropdown de jogadores da categoria
│   └── BossMatchModal.tsx                  // Modal de match encontrado
├── dashboard/
│   └── _components/
│       └── BossFightCard.tsx               // Card "Boss Fight Disponível" no dashboard
├── boss-fight/
│   ├── page.tsx                            // Página da batalha cooperativa
│   └── _components/
│       ├── CoopBattleArena.tsx             // Layout principal arena coop
│       ├── BossCard.tsx                    // Card do boss
│       ├── TeamPanel.tsx                   // 3 cards dos players
│       ├── CoopSkillBar.tsx                // Skills + seletor de aliado
│       ├── AllyTargetSelector.tsx          // Escolher aliado para SINGLE_ALLY
│       ├── CoopBattleResult.tsx            // Modal resultado
│       └── TurnTimer.tsx                   // Countdown visual do turno

app/api/battle/coop/
├── eligible/route.ts                       // (já existe)
├── history/route.ts                        // (já existe)
└── category-players/route.ts               // NOVA — jogadores da mesma categoria
```

---

## 10. Verificação

### Testes manuais
1. Dashboard: completar 5/5 tasks → card "Boss Fight" aparece
2. Clicar "Entrar na Fila" → barra inferior aparece com timer
3. Navegar para /character → barra continua lá
4. Clicar "Ver Jogadores" → dropdown com feed de atividade
5. Abrir 3 tabs com 3 usuários → todos entram na fila → match found
6. Modal aparece nos 3 → aceitar → redirecionados para /boss-fight
7. Batalha: escolher skills, ver indicadores "Agiu/Pensando"
8. Boss morre → modal vitória com EXP + Essência
9. Voltar ao dashboard → card "Já participou hoje"
