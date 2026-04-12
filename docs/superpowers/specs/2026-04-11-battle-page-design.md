# Pagina /battle — Design Spec

## Objetivo

Pagina de batalha PvE por turnos estilo RPG classico. Tres fases: IDLE (iniciar), BATTLE (combate turno a turno), RESULT (resultado com EXP). Suporte a SFX e imagens futuras de mobs.

## Fluxo

Estado `phase`: IDLE → BATTLE → RESULT

### IDLE
- Card centralizado, titulo "Batalha PvE", botao "Iniciar Batalha"
- Ao montar: verificar se ja tem batalha ativa via hasActiveBattle no state
- POST /api/battle/pve/start → recebe battleId, mob info, player info, initialState

### BATTLE
- Layout vertical: mob (topo) → log (centro) → jogador (baixo)
- Mob: placeholder/imagem, nome, tier badge, barra HP, status effects
- Log: feed dos eventos do ultimo turno, animacoes CSS (shake dano, flash cura)
- Jogador: avatar, nome, level, barra HP, status effects, 4 botoes de skills, botao pular turno
- POST /api/battle/pve/action com { battleId, skillId } → recebe events, HP atualizado, battleOver
- Apos cada turno: atualizar HP, status, cooldowns, mostrar eventos animados
- Se battleOver: transitar para RESULT

### RESULT
- Resultado: Vitoria (verde) / Derrota (vermelho) / Empate (cinza)
- EXP ganho, levels ganhos
- Botoes: "Jogar novamente" + "Voltar ao Dashboard"
- SFX: victory.mp3 ou defeat.mp3

## APIs usadas

- POST /api/battle/pve/start → { battleId, mob, player, initialState }
- POST /api/battle/pve/action → { events: TurnLogEntry[], playerHp, mobHp, battleOver, result?, expGained?, levelsGained?, newLevel? }
- GET /api/battle/pve/state?battleId=X → estado completo com availableSkills

## Audio

- Ao usar skill: new Audio("/sfx/{slug}.mp3").play().catch(() => {}) — fallback silencioso
- Hit generico: /sfx/hit.mp3
- Vitoria: /sfx/victory.mp3
- Derrota: /sfx/defeat.mp3
- Preparado para soundtrack de fundo (loop) futuro

## Mob visual

- Suporte a imageUrl (campo futuro)
- Placeholder: circulo com inicial do nome, cor por tier (T1=gray, T2=green, T3=blue, T4=purple, T5=amber)

## Animacoes CSS

- Shake no dano (translateX oscilando)
- Flash vermelho/verde no HP mudando
- Pulse nos status effects
- Fade-in nos eventos do log
- Glow nos buffs ativos

## Componentes

| Componente | Responsabilidade |
|---|---|
| BattlePage (page.tsx) | State machine (phase), data fetching, handlers |
| BattleIdle | Tela inicial com botao iniciar |
| BattleArena | Tela de combate completa |
| FighterDisplay | Mostra um lutador (mob ou player) com HP, status, imagem |
| BattleLog | Feed de eventos do turno |
| SkillBar | 4 botoes de skill + pular turno |
| BattleResult | Tela de resultado com EXP |

## Restricoes

- Tailwind puro + CSS animations, sem libs externas
- Client Component ("use client")
- Sem any no TypeScript
- SFX com fallback silencioso (catch vazio no play())
- Responsive: funciona em mobile e desktop
