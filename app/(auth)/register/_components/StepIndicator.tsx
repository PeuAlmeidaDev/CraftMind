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
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                step < current
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                  : step === current
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] bg-transparent text-gray-500"
              }`}
            >
              {step < current ? "\u2713" : step}
            </div>
            <span
              className={`mt-1.5 text-[11px] font-medium transition-colors duration-300 ${
                step <= current ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mx-2 mb-5 h-0.5 w-12 rounded transition-colors duration-300 sm:w-16 ${
                step < current ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
