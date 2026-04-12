**CRAFT MIND**

Game Design Document

*Versao 0.1 --- Em desenvolvimento*

*Documento vivo --- atualizado a cada decisao de design*

**1. Visao Geral**

Craft Mind e um jogo de batalha por turnos competitivo e multiplayer
online, acessado pelo navegador. Seu diferencial e a integracao entre
desenvolvimento pessoal real e progresso no jogo: os habitos saudaveis
que o jogador pratica na vida real alimentam diretamente os atributos do
seu personagem.

Quem vive melhor, joga melhor.

  ----------------- -----------------------------------------------------
  **Genero**        RPG / Batalha por turnos competitivo

  **Plataforma**    Navegador (HTML / CSS / JavaScript)

  **Multiplayer**   Online em tempo real (Socket.io)

  **Interface**     Sem graficos 3D --- cards, botoes e textos (estilo
                    Pokemon)
  ----------------- -----------------------------------------------------

**2. Modos de Jogo**

O jogo possui dois modos principais que se complementam:

**Modo Craft Mind**

O nucleo do jogo. O jogador cumpre desafios diarios baseados em habitos
saudaveis escolhidos por ele. Cada habito cumprido concede pontos de
atributo ao personagem, que cresce junto com o jogador. A intencao e que
o jogador sinta seu personagem evoluindo conforme ele mesmo evolui na
vida real.

**Modo Batalha (Normal)**

O modo competitivo. Dois jogadores se enfrentam em uma batalha por
turnos no estilo Pokemon. O personagem utilizado na batalha e o mesmo
desenvolvido no Craft Mind --- os atributos ganhos pelos habitos
determinam o poder do personagem em combate.

**3. Sistema de Habitos (Craft Mind)**

Ao se cadastrar, o jogador seleciona suas categorias de interesse entre
os cinco tipos de habitos disponiveis. As metas diarias sao geradas com
base nessas escolhas.

**Categorias de Habitos**

  ------------------ ------------------------------ -----------------------
  **Categoria**      **Exemplos de habitos**        **Atributos
                                                    beneficiados**

  **Fisicos**        Flexao, Abdominal, Corrida,    Ataque Fisico, Defesa
                     Alongamento                    Fisica, Vida

  **Intelectuais**   Leitura, Estudo, Curso,        Ataque Magico + chance
                     Escrita                        de nova habilidade

  **Mentais**        Meditacao, Journaling,         Defesa Magica,
                     Respiracao                     Velocidade

  **Sociais**        Conversa, Trabalho em equipe,  A definir
                     Voluntario                     

  **Espirituais**    Oracao, Gratidao, Contemplacao A definir
  ------------------ ------------------------------ -----------------------

**Exemplo de meta diaria e ganho de atributo**

-   Flexao de Braco: +3 Ataque Fisico, +1 Defesa Fisica

-   Abdominal: +2 Defesa Fisica, +2 Ataque Fisico

-   Leitura (30 min): +2 Ataque Magico + chance de desbloquear
    habilidade

-   Meditacao: +2 Defesa Magica, +1 Velocidade

**4. Sistema de Casas**

Ao se cadastrar, o jogador e automaticamente alocado em uma das quatro
casas com base na combinacao de habitos que escolheu. A casa nao define
os atributos do personagem --- ela e uma identidade coletiva, como em
Harry Potter.

A casa serve para criar rivalidade, senso de pertencimento, ranking
coletivo e eventos competitivos entre grupos. Dois jogadores da mesma
casa podem ter personagens completamente diferentes dependendo dos
habitos que praticam.

  ------------ ------------ ---------------- -------------------------------
  **Casa**     **Animal**   **Habitos        **Essencia**
                            dominantes**     

  **Arion**    Leao         Fisicos          O guerreiro --- poder que se
                                             impos. Forca, disciplina do
                                             corpo, saude fisica.

  **Lycus**    Lobo         Fisicos +        O samurai --- poder que se
                            Intelectual +    aperfeicoou. Equilibrio entre
                            Mental           corpo, mente e estudo.

  **Noctis**   Coruja       Intelectual +    O sabio --- poder que
                            Espiritual       transcende. Conhecimento
                                             profundo e conexao espiritual.

  **Nereid**   Sereia       Social + Mental  O suporte --- poder que
                                             encanta. Resistencia,
                                             comunidade e controle
                                             emocional.
  ------------ ------------ ---------------- -------------------------------

*A casa e determinada automaticamente pelo sistema com base nos habitos
de maior frequencia selecionados no cadastro. O jogador pode ter habitos
de varias categorias --- a casa reflete apenas seu perfil predominante.*

**Funcionalidades das casas (roadmap)**

-   Ranking de casas --- pontuacao coletiva baseada nos habitos
    cumpridos pelos membros

-   Campeonato entre casas --- competicao periodica com recompensas

-   Torneio --- melhores jogadores de cada casa se enfrentam

-   Premiacoes --- reconhecimento para casas e jogadores destaque (a
    definir)

-   Visual personalizado --- card e interface com identidade visual da
    casa

-   Rivalidade na batalha --- historico e estatisticas de confrontos
    entre casas

**5. Sistema de Personagem**

**Atributos base (inspirados em Pokemon)**

-   Ataque Fisico --- determina o dano de habilidades fisicas na batalha

-   Defesa Fisica --- reduz o dano fisico recebido

-   Ataque Magico --- determina o dano de habilidades magicas

-   Defesa Magica --- reduz o dano magico recebido

-   Vida (HP) --- pontos de vida totais na batalha

-   Velocidade --- determina quem age primeiro no turno

**Habilidades do personagem**

Cada personagem possui ate 4 habilidades equipaveis para a batalha.
Habilidades sao desbloqueadas de duas formas:

-   Progressao automatica: habilidades basicas desbloqueadas ao atingir
    certos niveis de atributo

-   Chance por habito intelectual: ao cumprir habitos intelectuais,
    existe uma porcentagem de chance de desbloquear uma habilidade nova
    e unica

**6. Sistema de Batalha**

A batalha e por turnos, entre dois jogadores online. A interface e
minimalista: dois cards (um para cada personagem), barras de HP e quatro
botoes de habilidade.

**Regras de turno**

-   A ordem de acao e determinada pelo atributo Velocidade

-   Em cada turno, o jogador escolhe uma das 4 habilidades

-   O dano e calculado com base nos atributos do atacante e defensor

-   A batalha termina quando o HP de um personagem chega a zero

**Cooldown de Habilidades**

O unico recurso limitante de habilidades e o cooldown. NAO existe sistema
de PP (Power Points).

-   Cooldown 0: pode ser usada todo turno (sem restricao)

-   Cooldown 1: apos o uso, fica indisponivel por 1 turno

-   Cooldown 2: apos o uso, fica indisponivel por 2 turnos

Skills de tier mais alto tem cooldown maior:

-   Tier 1 = cooldown 0

-   Tier 2 = cooldown 1

-   Tier 3 = cooldown 2

**Interface da batalha (a definir)**

-   Card do jogador (esquerda): nome, HP atual, atributos principais

-   Card do oponente (direita): mesmas informacoes

-   Painel de habilidades: 4 botoes clicaveis com nome e descricao da
    habilidade

-   Log de batalha: texto descrevendo as acoes do turno

**7. Infraestrutura Tecnica**

  ----------------- -----------------------------------------------------
  **Frontend**      HTML, CSS, JavaScript puro

  **Backend**       Node.js + Express

  **Multiplayer**   Socket.io (comunicacao em tempo real)

  **Banco de        *A definir*
  dados**           

  **Deploy**        Railway, Render ou Fly.io (gratuito)
  ----------------- -----------------------------------------------------

**8. Plano de Desenvolvimento**

Ordem recomendada de construcao (do nucleo para a periferia):

-   Fase 1 --- GDD completo (este documento)

-   Fase 2 --- Login e cadastro com selecao de interesses

-   Fase 3 --- Sistema de habitos diarios e ganho de atributos

-   Fase 4 --- Desbloqueio de habilidades por porcentagem

-   Fase 5 --- Tela do personagem com evolucao visivel

-   Fase 6 --- Batalha local (2 jogadores na mesma maquina)

-   Fase 7 --- Multiplayer online com Socket.io

-   Fase 8 --- Matchmaking e lobby

-   Fase 9 --- Deploy e publicacao

**9. Decisoes Pendentes**

Pontos que ainda precisam ser definidos nas proximas sessoes de
planejamento:

-   Atributos para habitos Sociais e Espirituais (detalhamento completo)

-   Banco de dados a utilizar (MongoDB, PostgreSQL, Firebase\...)

-   Lista completa de habilidades e seus efeitos por casa

-   Formula de calculo de dano na batalha

-   Nivel maximo do personagem / cap de atributos

-   Sistema de matchmaking (ranking, nivel, aleatorio?)

-   Nome dos personagens (fixos, customizaveis, aleatorios?)

-   Criterio exato de alocacao nas casas (porcentagem de habitos?)

-   Visual de cada casa (cores, simbolos, identidade)

-   Monetizacao (se houver)

*Craft Mind GDD v0.1 --- Documento vivo, atualizado continuamente*
