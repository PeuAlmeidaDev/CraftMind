// app/privacy/page.tsx — Politica de privacidade publica
//
// Server Component. Texto sem acentos (convencao do projeto).
// Cobre LGPD para o sistema anti multi-account: dados coletados, finalidade,
// retencao, direito ao apagamento.

// TODO: confirmar email de suporte
const SUPPORT_EMAIL = "suporte@craftmind.app";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1
        className="mb-2 text-3xl font-bold sm:text-4xl"
        style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
      >
        Politica de Privacidade
      </h1>
      <p
        className="mb-10 text-sm italic"
        style={{
          fontFamily: "var(--font-garamond)",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
        }}
      >
        Como o Craft Mind trata seus dados pessoais.
      </p>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
        >
          Dados coletados em cada login
        </h2>
        <p
          className="mb-3 leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 75%, transparent)",
          }}
        >
          A cada login ou cadastro, registramos as seguintes informacoes:
        </p>
        <ul
          className="ml-6 list-disc space-y-1.5 leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 70%, transparent)",
          }}
        >
          <li>
            <strong className="text-white">Identificador de dispositivo (visitor ID):</strong> uma assinatura
            do seu navegador gerada localmente, sem cookie persistente.
          </li>
          <li>
            <strong className="text-white">Endereco IP:</strong> usado para limitar tentativas de acesso e
            identificar abuso.
          </li>
          <li>
            <strong className="text-white">User agent:</strong> informacao do navegador (nome, versao, sistema
            operacional) enviada automaticamente pelo seu cliente.
          </li>
          <li>
            <strong className="text-white">Data e hora do login.</strong>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
        >
          Finalidade
        </h2>
        <p
          className="leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 75%, transparent)",
          }}
        >
          Esses dados sao usados exclusivamente para seguranca da sua conta e
          deteccao de abuso, principalmente uso de multiplas contas pelo mesmo
          jogador (multi-account), que e proibido pelas regras do jogo competitivo.
          Os dados nao sao compartilhados com terceiros.
        </p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
        >
          Retencao
        </h2>
        <p
          className="leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 75%, transparent)",
          }}
        >
          Os registros de login ficam armazenados por 90 dias. Apos esse periodo,
          eles sao apagados automaticamente.
        </p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
        >
          Direito ao apagamento
        </h2>
        <p
          className="leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 75%, transparent)",
          }}
        >
          Quando voce deleta sua conta, todos os seus registros de login sao
          apagados imediatamente, junto com seus demais dados pessoais. Voce
          pode tambem solicitar o apagamento ou exportacao a qualquer momento
          entrando em contato.
        </p>
      </section>

      <section>
        <h2
          className="mb-3 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)", color: "white" }}
        >
          Contato
        </h2>
        <p
          className="leading-relaxed"
          style={{
            fontFamily: "var(--font-garamond)",
            color: "color-mix(in srgb, var(--gold) 75%, transparent)",
          }}
        >
          Duvidas, exportacao ou exclusao de dados:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline"
            style={{ color: "var(--ember)" }}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
