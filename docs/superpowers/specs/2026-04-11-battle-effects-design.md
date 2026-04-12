# Battle Effects Design

## Efeitos Visuais de Batalha

### 1. Flash de dano/vitoria nos cards
- Dano recebido: flash vermelho semi-transparente (bg-red-500/30) cobrindo o card inteiro, fade out ~300ms
- Dano causado: flash branco semi-transparente (bg-white/20) no card do inimigo, fade out ~300ms
- Vitoria: flash dourado (bg-amber-400/25) cobrindo a tela inteira, fade out ~400ms

### 2. Slash de ataque
- SVG animado de slash diagonal sobre o card do inimigo quando o jogador ataca
- Linha branca/luminosa que aparece e desvanece (~400ms)
- Estrutura preparada para mapear efeitos diferentes por skill no futuro (Record<string, EffectType> com fallback para slash padrao)
- Skills magicas podem ter efeito diferente depois, por agora todas usam slash

### 3. Numeros de dano flutuantes
- Dano recebido: numero vermelho ("-45") aparece sobre o card, sobe ~30px e faz fade out (~800ms)
- Cura: numero verde ("+20") com mesmo comportamento
- Posicionado no centro-topo do card do alvo
- CSS keyframes: translateY + opacity

### 4. Efeitos de status nos cards
- Borda colorida pulsante: card do lutador afetado ganha borda com cor do status (laranja burn, cyan frozen, verde poison) com pulse no glow
- Particulas sobre a imagem (desktop only):
  - BURN: 3-4 chamas subindo com fade
  - FROZEN: flocos de gelo caindo
  - POISON: bolhas verdes subindo
  - STUN: estrelas girando
  - SLOW: ondas azuis
- Mobile (barras compactas): so borda colorida pulsante, sem particulas

### 5. Card do adversario derrotado
- Quando mob chega a 0 HP, sequencia de ~1.5s antes de ir pro RESULT:
  1. Card transiciona para preto e branco (filter: grayscale(1)) — 400ms
  2. Overlay de rachaduras (SVG) aparece com fade in — 400ms
  3. Card desmorona: fragmentos caem via CSS (translateY + rotate + opacity) — 700ms

### 6. Flash de tela
- Dano critico: flash vermelho semi-transparente cobrindo tela inteira, some em ~300ms
- Vitoria: flash dourado cobrindo tela inteira, some em ~400ms

### Arquitetura
- Novo arquivo BattleEffects.tsx: renderiza overlays (slash, flash, numeros, particulas)
- Trigger via BattleArena.tsx: useEffect existente detecta novos eventos e dispara efeitos via state
- Animacoes via CSS @keyframes em styled-jsx
- Sem libs externas
