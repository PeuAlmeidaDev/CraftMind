import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Codex de Combate | Craft Mind",
  description:
    "Fundamentos do combate por turnos do Craft Mind: ordem de turno, formula de dano, atributos, accuracy, status effects, stages e cristais.",
};

const SECTIONS: { id: string; numero: string; titulo: string }[] = [
  { id: "secao-1", numero: "01", titulo: "Combate & Ordem de Turno" },
  { id: "secao-2", numero: "02", titulo: "Formula de Dano" },
  { id: "secao-3", numero: "03", titulo: "Atributos: HP vs Defesa" },
  { id: "secao-4", numero: "04", titulo: "Accuracy: Acerto & Erro" },
  { id: "secao-5", numero: "05", titulo: "Status Effects" },
  { id: "secao-6", numero: "06", titulo: "Stages (Buffs/Debuffs)" },
  { id: "secao-7", numero: "07", titulo: "Cards: Pureza & Espectrais" },
];

const TABLE_CELL_CLASS =
  "px-3 py-2 border border-[color-mix(in_srgb,var(--gold)_25%,transparent)] align-top";
const TABLE_HEAD_CELL_CLASS = `${TABLE_CELL_CLASS} text-left font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)]`;
const TABLE_BODY_CELL_CLASS = `${TABLE_CELL_CLASS} font-[var(--font-cormorant)]`;

function SectionHeading({
  numero,
  titulo,
}: {
  numero: string;
  titulo: string;
}) {
  return (
    <h2 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl text-[var(--gold)] tracking-wide mb-6 sm:mb-8">
      {numero} — {titulo}
    </h2>
  );
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-mono text-sm bg-[var(--bg-card)] border-l-2 border-[var(--ember)] px-4 py-3 my-4 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function GoldCallout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="border-l-2 border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] px-4 py-3 italic my-4 font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
      {children}
    </aside>
  );
}

export default function CodexPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Cabecalho */}
        <header>
          <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl text-[var(--gold)] tracking-wide">
            Codex de Combate
          </h1>
          <p className="font-[var(--font-garamond)] italic text-lg sm:text-xl text-[var(--text-secondary)] mt-3">
            Conhecimento e poder. Estude as fundacoes do combate.
          </p>
        </header>

        <hr className="border-t border-[var(--border-subtle)] my-8 sm:my-10" />

        {/* Indice */}
        <nav
          aria-label="Indice"
          className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-md p-5"
        >
          <h2 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)]">
            Indice
          </h2>
          <ol className="mt-4 flex flex-col gap-2 list-none p-0">
            {SECTIONS.map((sec) => (
              <li
                key={sec.id}
                className="font-[var(--font-cormorant)] text-base sm:text-lg"
              >
                <a
                  href={`#${sec.id}`}
                  className="text-[var(--text-primary)] hover:text-[var(--gold)] transition-colors"
                >
                  <span className="font-mono text-sm text-[var(--ember)] mr-3">
                    {sec.numero}
                  </span>
                  {sec.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* SECAO 1 — Combate & Ordem de Turno */}
        <section id="secao-1" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="01" titulo="Combate & Ordem de Turno" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            Cada batalha do Craft Mind e por turnos simultaneos. Todos os
            jogadores submetem sua acao em segredo, depois o engine resolve em
            uma ordem deterministica.
          </p>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-6 mb-3">
            Como a ordem e decidida
          </h3>
          <ol className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-decimal pl-6 marker:text-[var(--gold)] flex flex-col gap-1">
            <li>
              Prioridade da skill (effects do tipo PRIORITY_SHIFT alteram esse
              valor)
            </li>
            <li>Speed do personagem (com stages aplicados)</li>
            <li>Sorte (desempate aleatorio)</li>
          </ol>

          <GoldCallout>
            Player A tem speed 80 e usa skill com priority 0. Player B tem
            speed 60 e usa skill com priority +1. Resultado: Player B age
            PRIMEIRO, porque priority maior ganha de speed maior.
          </GoldCallout>

          <GoldCallout>
            <strong className="not-italic font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--gold)]">
              SPEED NAO AFETA ESQUIVA.
            </strong>{" "}
            Ao contrario de Pokemon e outros RPGs, no Craft Mind a chance de
            errar um ataque e calculada exclusivamente pela accuracy da skill
            modificada pelos stages de accuracy do atacante. Speed serve so pra
            ordem de turno.
          </GoldCallout>
        </section>

        {/* SECAO 2 — Formula de Dano */}
        <section id="secao-2" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="02" titulo="Formula de Dano" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            O calculo de dano vive em{" "}
            <code className="font-mono text-sm text-[var(--ember)]">
              lib/battle/damage.ts
            </code>{" "}
            e segue a mesma formula pra todos os modos (PvP, PvE, Coop, Boss
            Fight).
          </p>

          <FormulaBlock>
            dano = (basePower x (atk/def) x 0.5  +  basePower x 0.1) x vulnMult x randomMult
          </FormulaBlock>

          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-2 mt-4">
            <li>
              <code className="font-mono text-sm font-bold text-[var(--gold)]">
                basePower
              </code>
              : poder bruto da skill, varia de 30 a 100 nas skills atuais.
            </li>
            <li>
              <code className="font-mono text-sm font-bold text-[var(--gold)]">
                atk
              </code>
              : ataque efetivo do atacante. Usa{" "}
              <code className="font-mono text-sm">physicalAtk</code> se a skill
              e PHYSICAL,{" "}
              <code className="font-mono text-sm">magicAtk</code> se MAGICAL.
              Inclui stages aplicados.
            </li>
            <li>
              <code className="font-mono text-sm font-bold text-[var(--gold)]">
                def
              </code>
              : defesa efetiva do alvo. Usa{" "}
              <code className="font-mono text-sm">physicalDef</code> ou{" "}
              <code className="font-mono text-sm">magicDef</code> correspondente
              ao damageType. Inclui stages.
            </li>
            <li>
              <code className="font-mono text-sm font-bold text-[var(--gold)]">
                vulnMult
              </code>
              : multiplicador de vulnerabilidade. Padrao 1.0. Effects do tipo
              VULNERABILITY adicionam ao multiplicador. FROZEN tambem soma +30%
              contra ataques fisicos.
            </li>
            <li>
              <code className="font-mono text-sm font-bold text-[var(--gold)]">
                randomMult
              </code>
              : ruido aleatorio entre ~0.85 e 1.15 pra evitar previsao perfeita.
            </li>
            <li>
              <span className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)]">
                Floor de seguranca:
              </span>{" "}
              o dano final nunca e menor que 1 (sempre arranha).
            </li>
          </ul>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-8 mb-3">
            Tres exemplos passo a passo
          </h3>

          {/* Exemplo 1 */}
          <h4 className="font-[var(--font-garamond)] italic text-lg sm:text-xl text-[var(--text-secondary)] mt-6">
            Exemplo 1 — Ataque fisico simples
          </h4>
          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-1 mt-2">
            <li>Skill: basePower 50, damageType PHYSICAL, single hit</li>
            <li>Attacker: physicalAtk 80, sem stages</li>
            <li>Defender: physicalDef 50, sem vulnerabilidade</li>
            <li>vulnMult = 1.0, randomMult = 1.0 (idealizado)</li>
          </ul>
          <FormulaBlock>
{`(50 x (80/50) x 0.5 + 50 x 0.1) x 1.0 x 1.0
= (50 x 1.6 x 0.5 + 5)
= (40 + 5)
= 45 de dano`}
          </FormulaBlock>

          {/* Exemplo 2 */}
          <h4 className="font-[var(--font-garamond)] italic text-lg sm:text-xl text-[var(--text-secondary)] mt-6">
            Exemplo 2 — Magico com vulnerabilidade
          </h4>
          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-1 mt-2">
            <li>Skill: basePower 70, damageType MAGICAL</li>
            <li>Attacker: magicAtk 100, sem stages</li>
            <li>Defender: magicDef 80, com VULNERABILITY MAGICAL +25%</li>
            <li>vulnMult = 1.25, randomMult = 1.0</li>
          </ul>
          <FormulaBlock>
{`(70 x (100/80) x 0.5 + 70 x 0.1) x 1.25 x 1.0
= (70 x 1.25 x 0.5 + 7) x 1.25
= (43.75 + 7) x 1.25
= 50.75 x 1.25
~= 63 de dano`}
          </FormulaBlock>

          {/* Exemplo 3 */}
          <h4 className="font-[var(--font-garamond)] italic text-lg sm:text-xl text-[var(--text-secondary)] mt-6">
            Exemplo 3 — Multi-hit
          </h4>
          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-1 mt-2">
            <li>Skill: basePower 30, hits 3, PHYSICAL</li>
            <li>Attacker physicalAtk 60, defender physicalDef 40</li>
            <li>vulnMult = 1.0, randomMult = 1.0</li>
          </ul>
          <FormulaBlock>
{`por hit: (30 x (60/40) x 0.5 + 30 x 0.1) = 22.5 + 3 = 25.5 ~= 25
total: 25 x 3 = 75 de dano`}
          </FormulaBlock>

          <p className="font-[var(--font-cormorant)] italic text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] mt-4">
            Cada hit roda o random independente, entao na pratica o total
            varia. Multi-hit estora defesas altas porque o floor{" "}
            <code className="font-mono text-sm not-italic">
              basePower x 0.1
            </code>{" "}
            aplica em cada hit.
          </p>
        </section>

        {/* SECAO 3 — Atributos: HP vs Defesa */}
        <section id="secao-3" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="03" titulo="Atributos: HP vs Defesa" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            O ponto livre que voce gasta em HP vale 10 de vida. O ponto em DEF
            vale 1. Mas DEF tem retorno decrescente (cada ponto vale menos
            quando voce ja tem muita), enquanto HP e linear. Existe um sweet
            spot.
          </p>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-6 mb-3">
            Eficiencia por ponto
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:text-base border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Estado</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>
                    DEF: % reducao por ponto
                  </th>
                  <th className={TABLE_HEAD_CELL_CLASS}>
                    HP: % EHP por ponto
                  </th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Vencedor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    DEF 50, HP 1000 (vs ATK 80)
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>~1.74%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.0%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>DEF (~1.7x melhor)</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    DEF 100, HP 1000 (vs ATK 80)
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>~0.95%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.0%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Empate</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    DEF 200, HP 1000 (vs ATK 80)
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>~0.33%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.0%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>HP (~3x melhor)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <GoldCallout>
            Mantenha DEF aproximadamente igual a HP / 10. Abaixo desse ratio,
            cada ponto em DEF rende mais. Acima, HP rende mais.
          </GoldCallout>

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed mt-4">
            Cada ponto de HP vira +10 de vida; cada ponto de DEF vira +1 de
            defesa. O retorno marginal de DEF iguala o da HP exatamente nesse
            ratio 10:1.
          </p>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-8 mb-3">
            Diagnostico de builds
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:text-base border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Build</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>HP</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>DEF</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Diagnostico</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>Glass cannon</td>
                  <td className={TABLE_BODY_CELL_CLASS}>600</td>
                  <td className={TABLE_BODY_CELL_CLASS}>10</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    DEF critica, qualquer hit limpa
                  </td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>Tank squishy</td>
                  <td className={TABLE_BODY_CELL_CLASS}>800</td>
                  <td className={TABLE_BODY_CELL_CLASS}>30</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    HP eh 26x DEF — DEF urgente
                  </td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>Balanceado</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1000</td>
                  <td className={TABLE_BODY_CELL_CLASS}>100</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    Ratio 10:1, equilibrado
                  </td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>Tank saturado</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1500</td>
                  <td className={TABLE_BODY_CELL_CLASS}>250</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    HP so 6x DEF, HP rende mais agora
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-8 mb-3">
            Excecoes
          </h3>
          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-2">
            <li>
              Contra builds magic-heavy: physicalDef vira inutil, foque
              magicDef. E vice-versa pra builds puramente fisicas.
            </li>
            <li>
              Quando o adversario aplica VULNERABILITY: o vulnMult amplifica o
              dano DEPOIS do calculo de defesa, entao HP fica relativamente
              mais valioso.
            </li>
            <li>
              Contra multi-hit de basePower baixo: o floor{" "}
              <code className="font-mono text-sm">basePower x 0.1</code> por hit
              e pequeno, entao DEF continua otima pra reduzir os hits
              individuais.
            </li>
          </ul>
        </section>

        {/* SECAO 4 — Accuracy: Acerto & Erro */}
        <section id="secao-4" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="04" titulo="Accuracy: Acerto & Erro" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            Toda skill tem um campo{" "}
            <code className="font-mono text-sm text-[var(--ember)]">
              accuracy
            </code>{" "}
            (1 a 100) que define a % base de acerto. Stages do atacante em{" "}
            <code className="font-mono text-sm text-[var(--ember)]">
              accuracy
            </code>{" "}
            modificam a chance via STAGE_MULTIPLIERS.
          </p>

          <FormulaBlock>
            hitChance = clamp(skill.accuracy x STAGE_MULTIPLIERS[attacker.stages.accuracy], 10, 100)
          </FormulaBlock>

          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-2 mt-4">
            <li>Cap minimo: 10% (sempre tem alguma chance de acertar).</li>
            <li>Cap maximo: 100% (stages positivos nao ultrapassam 100%).</li>
            <li>
              Skills puras de suporte (
              <code className="font-mono text-sm">
                damageType === &quot;NONE&quot;
              </code>
              , <code className="font-mono text-sm">basePower === 0</code>,{" "}
              <code className="font-mono text-sm">
                target === &quot;SELF&quot;
              </code>
              ) NUNCA erram.
            </li>
            <li>
              Em caso de miss, o cooldown da skill ainda conta e o combo reseta.
            </li>
            <li>
              A IA dos mobs PvE penaliza skills com accuracy &lt; 100
              proporcionalmente no scoring (
              <code className="font-mono text-sm">
                score *= accuracy / 100
              </code>
              ).
            </li>
          </ul>
        </section>

        {/* SECAO 5 — Status Effects */}
        <section id="secao-5" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="05" titulo="Status Effects" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            Status effects sao condicoes que duram varios turnos e disparam
            efeitos automaticos. Sao aplicados via skills com effect do tipo
            STATUS.
          </p>

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm sm:text-base border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Status</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Dano/Turno</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Side Effect</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ao Expirar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>STUN</td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    Impede acao no turno
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>FROZEN</td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    Impede acao + 30% vuln a dano fisico
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>BURN</td>
                  <td className={TABLE_BODY_CELL_CLASS}>6% HP max</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    physicalAtk -1 stage
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    Reverte physicalAtk +1
                  </td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>POISON</td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    4% / 6% / 8% HP max (escala por turno)
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>SLOW</td>
                  <td className={TABLE_BODY_CELL_CLASS}>—</td>
                  <td className={TABLE_BODY_CELL_CLASS}>speed -2 stages</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Reverte speed +2</td>
                </tr>
              </tbody>
            </table>
          </div>

          <GoldCallout>
            O dano de status acontece NO INICIO do turno do afetado, ANTES dele
            agir. Pode matar o jogador antes que ele tenha chance de jogar a
            skill escolhida.
          </GoldCallout>
        </section>

        {/* SECAO 6 — Stages (Buffs/Debuffs) */}
        <section id="secao-6" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="06" titulo="Stages (Buffs/Debuffs)" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            Cada atributo do personagem tem seu proprio stage, clampado entre
            -4 e +4. Buffs aumentam o stage, debuffs diminuem. O valor efetivo
            do atributo em batalha e{" "}
            <code className="font-mono text-sm">
              base x STAGE_MULTIPLIERS[stage]
            </code>
            .
          </p>

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm sm:text-base border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Stage</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Multiplicador</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>-4</td>
                  <td className={TABLE_BODY_CELL_CLASS}>0.40</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>-3</td>
                  <td className={TABLE_BODY_CELL_CLASS}>0.50</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>-2</td>
                  <td className={TABLE_BODY_CELL_CLASS}>0.65</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>-1</td>
                  <td className={TABLE_BODY_CELL_CLASS}>0.80</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>0</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.00</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>+1</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.25</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>+2</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.50</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>+3</td>
                  <td className={TABLE_BODY_CELL_CLASS}>1.75</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>+4</td>
                  <td className={TABLE_BODY_CELL_CLASS}>2.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-2 mt-6">
            <li>
              Cada stat (atk, def, magicAtk, magicDef, speed, accuracy) tem
              stage independente.
            </li>
            <li>
              Status effects tambem mexem em stages como side effect (BURN tira
              physicalAtk, SLOW tira speed).
            </li>
            <li>
              Stages ZERAM no fim da batalha. A duracao em turnos e definida
              pelo effect que aplicou.
            </li>
          </ul>
        </section>

        {/* SECAO 7 — Cards: Pureza & Espectrais */}
        <section id="secao-7" className="mt-12 sm:mt-16 scroll-mt-24">
          <SectionHeading numero="07" titulo="Cards: Pureza & Espectrais" />

          <p className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed">
            Toda carta dropa com um valor de{" "}
            <code className="font-mono text-sm text-[var(--ember)]">
              purity
            </code>{" "}
            entre 0 e 100. A distribuicao foi calibrada pra dar a sensacao de
            &quot;shiny&quot; estilo Pokemon — a maior parte e mediana, raros
            sao excelentes, e Espectrais sao eventos genuinamente raros.
          </p>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-6 mb-3">
            Distribuicao de purity
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:text-base border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Faixa</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Frequencia</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Apelido</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>0-39</td>
                  <td className={TABLE_BODY_CELL_CLASS}>8%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Lixo</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>40-69</td>
                  <td className={TABLE_BODY_CELL_CLASS}>55%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Medio</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>70-89</td>
                  <td className={TABLE_BODY_CELL_CLASS}>26%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Bom</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>90-94</td>
                  <td className={TABLE_BODY_CELL_CLASS}>7%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Otimo</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>95-99</td>
                  <td className={TABLE_BODY_CELL_CLASS}>3.5%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Excelente</td>
                </tr>
                <tr>
                  <td className={TABLE_BODY_CELL_CLASS}>100</td>
                  <td className={TABLE_BODY_CELL_CLASS}>0.5%</td>
                  <td className={TABLE_BODY_CELL_CLASS}>Espectral</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-[var(--font-cormorant)] italic text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] mt-4">
            Cartas de mob 3 estrelas tem floor de 30 — nunca rolam lixo
            absoluto.
          </p>

          <h3 className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] mt-8 mb-3">
            Como purity escala bonus
          </h3>
          <FormulaBlock>
            effectFinal = effect.value x (purity / 50) x levelMultiplier
          </FormulaBlock>

          <ul className="font-[var(--font-cormorant)] text-base sm:text-lg leading-relaxed list-disc pl-6 marker:text-[var(--gold)] flex flex-col gap-2 mt-4">
            <li>Pureza 50 = 1.0x (baseline).</li>
            <li>Pureza 100 = 2.0x.</li>
            <li>Pureza 0 = 0x (efeito nulo, mas ainda colecionavel).</li>
            <li>Level multiplier: 1.0 no Lv1, escala ate 1.8 no Lv5.</li>
            <li>
              Combinado: uma carta Lv5 com 100% purity ={" "}
              <code className="font-mono text-sm">
                effect x 2.0 x 1.8 = 3.6x
              </code>{" "}
              o effect base.
            </li>
          </ul>

          <GoldCallout>
            Espectral (purity exata 100) NAO eh so cosmetico. A carta ganha alt
            art holografica, glow dourado animado, anuncio global no toast
            quando dropar — e desbloqueia o 5o slot de skill em batalha. O dono
            escolhe uma das 4 skills do mob de origem da carta pra equipar
            nesse slot extra.
          </GoldCallout>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border-subtle)] mt-16 sm:mt-20 py-8 sm:py-10 text-center">
          <a
            href="/dashboard"
            className="font-[var(--font-cinzel)] uppercase tracking-widest text-xs text-[var(--ember)] hover:text-[var(--gold)] transition-colors"
          >
            ← Voltar pro jogo
          </a>
        </footer>
      </div>
    </main>
  );
}
