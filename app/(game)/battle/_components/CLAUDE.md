# battle/_components/ — Componentes da Tela de Batalha

Componentes Client-side (`"use client"`) usados exclusivamente pela pagina `/battle`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `BattleIdle.tsx` | Tela "Camara de Guerra" pre-batalha com grid de 3 mode cards (1v1 featured, Multi Mobs, Coop PvE). Props: `onStart`, `loading`, `playerName`, `houseName`. Usa fontes Cinzel/Cormorant/Garamond/JetBrains e CSS vars do tema. Importa `HOUSE_LORE` para motto no footer. |
| `BattleArena.tsx` | Layout responsivo de batalha: desktop (cards com imagem) e mobile (barras compactas). Renderiza mob, player, HP, status effects, BattleLog e SkillBar inline. Shake animation via styled-jsx. Usa MobPlaceholder para retrato do mob e bandeira da casa via next/image. |
| `SkillBar.tsx` | Grid 2x2 com 4 slots de skill + botao pular turno |
| `BattleLog.tsx` | Feed de eventos do turno com scroll automatico |
| `BattleResult.tsx` | **NAO USADO** — resultado agora e inline em `page.tsx`. Mantido como referencia para possivel extracao futura. |
| `SkillVfx.tsx` | Overlay de VFX por skill (slash/arcane/heal/fire). Mapeamento `skillName -> tipo` interno. CSS puro em `skill-vfx.css`. Renderizado dentro dos cards de player e mob no BattleArena. |
| `skill-vfx.css` | Keyframes e estilos dos 4 efeitos visuais: slash (700ms), arcane (800ms), heal (1100ms), fire (750ms). Classe base `.vfx` com `.active` para disparar. |
| `AttackEffect.tsx` | **NAO IMPORTADO** — efeito visual de slash legado. Mantido para referencia. |
| `MobPlaceholder.tsx` | Retrato do mob via next/image (Cloudinary URL) com fallback para gradiente por tier + inicial do nome. Props: `name`, `tier`, `imageUrl?` |
| `StatusParticles.tsx` | Particulas visuais por status effect (BURN, FROZEN, POISON, STUN, SLOW). Renderizado apenas no desktop, dentro da area de imagem dos cards. Sem libs externas, posicoes fixas (sem Math.random). |
| `DefeatSequence.tsx` | **NAO IMPORTADO** — sequencia de derrota do mob. Mantido para uso futuro. |

## Convencoes

- Todos os tipos sao importados de `../page.tsx` (`AvailableSkill`, `TurnLogEntry`, etc.)
- Cores via CSS variables do tema (`var(--bg-card)`, `var(--border-subtle)`, `var(--accent-primary)`)
- Sem libs externas — animacoes via `<style>` inline com `@keyframes`
- SFX de skills: arquivos `.mp3` em `/public/sfx/{slug}.mp3` onde slug e o nome da skill em lowercase, sem acentos, espacos viram hifens
