# battle/_components/ — Componentes da Tela de Batalha

Componentes Client-side (`"use client"`) usados exclusivamente pela pagina `/battle`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `BattleIdle.tsx` | Tela inicial pre-batalha com botao "Iniciar" |
| `BattleArena.tsx` | Layout responsivo de batalha: desktop (cards com imagem) e mobile (barras compactas). Renderiza mob, player, HP, status effects, BattleLog e SkillBar inline. Shake animation via styled-jsx. Usa MobPlaceholder para retrato do mob e bandeira da casa via next/image. |
| `SkillBar.tsx` | Grid 2x2 com 4 slots de skill + botao pular turno |
| `BattleLog.tsx` | Feed de eventos do turno com scroll automatico |
| `BattleResult.tsx` | Tela de resultado (vitoria/derrota/empate) com EXP, level up e SFX |
| `AttackEffect.tsx` | Efeito visual de slash SVG sobre o mob ao receber dano do jogador. Extensivel via `SKILL_EFFECTS` por skillId. z-20 (abaixo dos floating numbers z-30). |
| `MobPlaceholder.tsx` | Placeholder visual para retrato do mob — gradiente por tier + inicial do nome |
| `StatusParticles.tsx` | Particulas visuais por status effect (BURN, FROZEN, POISON, STUN, SLOW). Renderizado apenas no desktop, dentro da area de imagem dos cards. Sem libs externas, posicoes fixas (sem Math.random). |
| `DefeatSequence.tsx` | Sequencia de derrota do mob: grayscale -> cracks SVG -> crumble fragments. Renderizado dentro dos cards do mob (desktop e mobile). Dispara callback `onComplete` apos 1.5s. BattleArena envolve com flash de vitoria (amber, z-50, 0.4s). |

## Convencoes

- Todos os tipos sao importados de `../page.tsx` (`AvailableSkill`, `TurnLogEntry`, etc.)
- Cores via CSS variables do tema (`var(--bg-card)`, `var(--border-subtle)`, `var(--accent-primary)`)
- Sem libs externas — animacoes via `<style>` inline com `@keyframes`
- SFX de skills: arquivos `.mp3` em `/public/sfx/{slug}.mp3` onde slug e o nome da skill em lowercase, sem acentos, espacos viram hifens
