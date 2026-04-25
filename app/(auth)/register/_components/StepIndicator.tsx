type Step = 1 | 2 | 3;

const STEP_LABELS = ["Dados", "Habitos", "Resultado"] as const;

/** Indicador de progresso de 3 etapas do cadastro */
export function StepIndicator({ current }: { current: Step }) {
  const steps = [1, 2, 3] as const;

  return (
    <div className="mb-8 flex items-center justify-center">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="flex h-7 w-7 items-center justify-center text-sm font-bold transition-all duration-300"
              style={
                step < current
                  ? {
                      backgroundColor: "var(--ember)",
                      border: "1px solid var(--ember)",
                      color: "white",
                    }
                  : step === current
                    ? {
                        backgroundColor: "color-mix(in srgb, var(--ember) 15%, transparent)",
                        border: "1px solid var(--ember)",
                        color: "var(--ember)",
                      }
                    : {
                        backgroundColor: "transparent",
                        border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
                        color: "color-mix(in srgb, var(--gold) 40%, transparent)",
                      }
              }
            >
              {step < current ? "\u2713" : step}
            </div>
            <span
              className="mt-1.5 uppercase transition-colors duration-300"
              style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "8px",
                letterSpacing: "0.2em",
                color:
                  step <= current
                    ? "color-mix(in srgb, var(--gold) 70%, transparent)"
                    : "color-mix(in srgb, var(--gold) 40%, transparent)",
              }}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mx-2 mb-5 h-0.5 w-12 transition-colors duration-300 sm:w-16"
              style={{
                backgroundColor:
                  step < current
                    ? "var(--ember)"
                    : "color-mix(in srgb, var(--gold) 20%, transparent)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
