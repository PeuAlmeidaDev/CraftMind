# Pagina /character — Design Spec

## Objetivo

Pagina de ficha do personagem onde o jogador visualiza stats, distribui pontos livres, gerencia loadout de skills e faz upload de avatar. Layout em duas colunas (desktop) que empilha no mobile.

## Layout geral

```
[Header do personagem — full width                          ]
[Atributos + Pontos (col esq)] [Skills loadout + inv (col dir)]
```

Desktop: `grid-cols-[320px_1fr]`. Mobile: empilha verticalmente.

---

## Secao 1: Header do personagem

Card horizontal full-width com:

- **Avatar**: circulo clicavel. Se `avatarUrl` existe, mostra a imagem. Senao, mostra inicial do nome em fundo accent. Ao clicar, abre `<input type="file" accept="image/jpeg,image/png,image/webp">` hidden, faz upload via `POST /api/user/avatar` (formData, max 5MB), atualiza a imagem no state.
- **Nome** do jogador + badge da casa (emoji + animal)
- **Level** em destaque + barra de EXP (mesma logica do dashboard: `currentExp / expToNextLevel(level)`)
- **Pontos livres** em badge accent se `freePoints > 0`

### Dados necessarios

- `GET /api/user/profile` → nome, house, avatarUrl
- `GET /api/character` → level, currentExp, freePoints, stats

---

## Secao 2: Painel de atributos (coluna esquerda)

Card com titulo "Atributos".

### Modo visualizacao (freePoints === 0)

Lista vertical dos 6 stats com icone, nome e valor:
- Ataque Fisico, Defesa Fisica, Ataque Magico, Defesa Magica, HP, Velocidade

### Modo distribuicao (freePoints > 0)

- Contador no topo: "X pontos livres"
- Cada stat com botoes +/- ao lado do valor
- Preview do valor novo: "10 → 12" (valor atual → valor apos alocacao) em cor accent
- Nota visual no HP: "(cada ponto = +10 HP)"
- Botao "-" desabilitado quando alocacao do stat === 0
- Botao "+" desabilitado quando pontos restantes === 0
- Botao **"Confirmar"** aparece quando total alocado > 0
- Botao **"Resetar"** limpa toda alocacao pendente (client-side, sem API)
- Ao confirmar: `POST /api/character/distribute-points` com `{ distribution }`. Atualiza stats no state com a resposta.

### Validacoes client-side

- Total alocado <= freePoints
- Cada valor >= 0 (inteiro)
- Pelo menos 1 stat com valor > 0 para habilitar "Confirmar"
- accuracy NAO aparece na lista (nao e distribuivel)

### API

- `POST /api/character/distribute-points` — body: `{ distribution: { physicalAtk?: number, ... } }`
- Resposta: character atualizado com novos stats e freePoints reduzido

---

## Secao 3: Skills (coluna direita)

### 3a. Loadout — 4 slots

Card com titulo "Loadout".

Grid 2x2 com slots 0-3:
- **Slot ocupado**: nome da skill (truncado), tier badge (T1=cinza, T2=azul, T3=roxo), cooldown se > 0, tipo de dano (icone ou texto), target. Botao X no canto para desequipar.
- **Slot vazio**: borda tracejada, texto "Escolher skill", clicavel.
- **Clique em qualquer slot** (vazio ou ocupado) → abre modal de selecao.

#### Desequipar

Botao X no slot → `PUT /api/character/skills/unequip` com `{ slotIndex }`. Atualiza state.

### 3b. Modal de selecao de skill

Acionado ao clicar em um slot. Overlay escuro + card centralizado.

**Header**: "Escolher habilidade — Slot X" + botao fechar (X).

**Filtros** (toggles horizontais):
- Tier: T1 / T2 / T3 (multi-select, todos ativos por default)
- Tipo de dano: Fisico / Magico / Nenhum (multi-select)
- Target: pode omitir inicialmente para simplificar

**Lista de skills**: cards compactos com:
- Nome, tier badge, cooldown, tipo de dano, descricao (1 linha truncada)
- Se a skill ja esta equipada em outro slot: badge "Slot X" — selecionar faz swap
- Clique → `PUT /api/character/skills/equip` com `{ skillId, slotIndex }` → fecha modal, atualiza state

**Estado vazio**: "Nenhuma habilidade desbloqueada" se o jogador nao tem skills.

### 3c. Inventario de skills

Card abaixo do loadout com titulo "Habilidades desbloqueadas (X/49)".

Grid responsivo (2 colunas mobile, 3 desktop) de cards com:
- Nome, tier badge, cooldown, tipo de dano
- Descricao completa
- Efeitos resumidos (ex: "BUFF +2 physicalAtk 3t", "STATUS BURN 30%")
- Se equipada: badge indicando qual slot

Sem acao de equip — serve como referencia/consulta.

### API

- `GET /api/character/skills` → `{ equipped: CharacterSkillSlot[], unequipped: CharacterSkillSlot[] }`
- `PUT /api/character/skills/equip` — body: `{ skillId, slotIndex }`
- `PUT /api/character/skills/unequip` — body: `{ slotIndex }`

---

## Data fetching

Ao montar a pagina, 3 fetches paralelos:
1. `GET /api/user/profile` → nome, house, avatarUrl
2. `GET /api/character` → stats, level, exp, freePoints
3. `GET /api/character/skills` → equipped + unequipped

Autenticacao via Bearer token do localStorage (mesmo padrao do dashboard).

---

## Componentes

Todos internos ao arquivo `app/(game)/character/page.tsx` (mesmo padrao do dashboard). Se ficar muito grande, extrair para `character/_components/`.

| Componente | Props |
|---|---|
| CharacterHeader | profile, character, onAvatarChange |
| AttributePanel | character, onDistribute |
| SkillLoadout | equipped, onSlotClick, onUnequip |
| SkillSelectModal | open, slotIndex, allSkills, equippedSlots, onSelect, onClose |
| SkillInventory | skills (all) |
| SkillCard | skill, variant ("compact" ou "full"), badge? |

---

## Tema visual

- Mesmo tema dark RPG do dashboard: --bg-card, --border-subtle, --accent-primary, --bg-secondary
- Tier colors: T1=gray, T2=blue, T3=purple
- Damage type icons: fisico=espada, magico=estrela, nenhum=escudo (emoji ou texto)
- Cards com rounded-xl, border, hover sutil

---

## Restricoes

- Sem bibliotecas externas de UI — Tailwind puro
- Sem `any` no TypeScript
- Client Component ("use client") — fetch com Bearer token
- Upload de avatar: max 5MB, JPEG/PNG/WebP apenas
- Nao permitir distribuir pontos ou trocar skills durante batalha ativa (API retorna 409, mostrar mensagem)
