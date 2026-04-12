"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Habit, HabitCategory, ApiSuccess, House, HabitSummary } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type CharacterStats = {
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
};

type RegisterResult = {
  user: {
    id: string;
    name: string;
    email: string;
    house: House;
    habits: HabitSummary[];
  };
  character: CharacterStats;
  accessToken: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<HabitCategory, string> = {
  PHYSICAL: "Fisico",
  INTELLECTUAL: "Intelectual",
  MENTAL: "Mental",
  SOCIAL: "Social",
  SPIRITUAL: "Espiritual",
};

const CATEGORY_BG: Record<HabitCategory, string> = {
  PHYSICAL: "bg-red-500",
  INTELLECTUAL: "bg-blue-500",
  MENTAL: "bg-violet-500",
  SOCIAL: "bg-amber-500",
  SPIRITUAL: "bg-emerald-500",
};

const CATEGORY_ORDER: HabitCategory[] = [
  "PHYSICAL",
  "INTELLECTUAL",
  "MENTAL",
  "SOCIAL",
  "SPIRITUAL",
];

const STAT_LABELS: Record<keyof CharacterStats, string> = {
  physicalAtk: "Ataque Fisico",
  physicalDef: "Defesa Fisica",
  magicAtk: "Ataque Magico",
  magicDef: "Defesa Magica",
  hp: "HP",
  speed: "Velocidade",
};

// ── Validation helpers ─────────────────────────────────────────────────────

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Nome deve ter no minimo 2 caracteres";
  if (trimmed.length > 50) return "Nome deve ter no maximo 50 caracteres";
  return undefined;
}

function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return "Email e obrigatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email invalido";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return "Senha deve ter no minimo 8 caracteres";
  if (!/[A-Z]/.test(password)) return "Senha deve conter pelo menos 1 letra maiuscula";
  if (!/[0-9]/.test(password)) return "Senha deve conter pelo menos 1 numero";
  return undefined;
}

function validateStep1(
  name: string,
  email: string,
  password: string,
  confirmPassword: string
): FieldErrors {
  const errors: FieldErrors = {};
  const nameErr = validateName(name);
  if (nameErr) errors.name = nameErr;
  const emailErr = validateEmail(email);
  if (emailErr) errors.email = emailErr;
  const passwordErr = validatePassword(password);
  if (passwordErr) errors.password = passwordErr;
  if (password !== confirmPassword) errors.confirmPassword = "As senhas nao coincidem";
  if (!confirmPassword) errors.confirmPassword = "Confirme sua senha";
  return errors;
}

// ── Password requirement indicator ─────────────────────────────────────────

function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "8+ caracteres", met: password.length >= 8 },
    { label: "1 letra maiuscula", met: /[A-Z]/.test(password) },
    { label: "1 numero", met: /[0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {requirements.map((req) => (
        <span
          key={req.label}
          className={`text-xs transition-colors duration-200 ${
            req.met ? "text-emerald-400" : "text-gray-500"
          }`}
        >
          <span className="mr-1">{req.met ? "\u2713" : "\u2022"}</span>
          {req.label}
        </span>
      ))}
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [1, 2, 3] as const;
  const labels = ["Dados", "Habitos", "Resultado"];

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
              {labels[i]}
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

// ── Habit card ─────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  selected,
  onToggle,
}: {
  habit: Habit;
  selected: boolean;
  onToggle: () => void;
}) {
  const dotColor = CATEGORY_BG[habit.category];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative w-full rounded-lg border p-3 text-left transition-all duration-200 ${
        selected
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-gray-600 hover:brightness-110"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-200 ${
            selected
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
              : "border-gray-600 bg-transparent"
          }`}
        >
          {selected && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200">{habit.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{habit.description}</p>
        </div>
      </div>
      <div
        className={`absolute right-2 top-2 h-2 w-2 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
    </button>
  );
}

// ── Main page component ────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>(1);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Step 2 fields
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [habitsError, setHabitsError] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // Step 3 result
  const [result, setResult] = useState<RegisterResult | null>(null);

  // Step transition
  const goToStep = useCallback((next: Step) => {
    setAnimating(true);
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
      setTimeout(() => setAnimating(false), 300);
    }, 250);
  }, []);

  // Fetch habits when entering step 2
  useEffect(() => {
    if (step !== 2 || habits.length > 0) return;

    let cancelled = false;
    setHabitsLoading(true);
    setHabitsError("");

    fetch("/api/habits")
      .then(async (res) => {
        if (!res.ok) throw new Error("Erro ao carregar habitos");
        const json = (await res.json()) as ApiSuccess<Habit[]>;
        if (!cancelled) setHabits(json.data);
      })
      .catch((err: Error) => {
        if (!cancelled) setHabitsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setHabitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, habits.length]);

  // ── Step 1 handlers ────────────────────────────────────────────────────

  function handleStep1Continue() {
    const errors = validateStep1(name, email, password, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      setApiError("");
      goToStep(2);
    }
  }

  // ── Step 2 handlers ────────────────────────────────────────────────────

  function toggleHabit(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 10) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size < 3 || selectedIds.size > 10) return;

    setSubmitting(true);
    setApiError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          habitIds: Array.from(selectedIds),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errBody = json as { error: string };
        setApiError(errBody.error || "Erro desconhecido");
        return;
      }

      const data = (json as ApiSuccess<RegisterResult>).data;

      // Salvar token no localStorage
      localStorage.setItem("access_token", data.accessToken);

      // Salvar token em cookie para o middleware
      document.cookie = `access_token=${data.accessToken}; path=/; max-age=${60 * 15}; SameSite=Strict`;

      setResult(data);
      goToStep(3);
    } catch {
      setApiError("Erro de conexao. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Group habits by category ───────────────────────────────────────────

  const habitsByCategory = CATEGORY_ORDER.reduce<Record<string, Habit[]>>(
    (acc, cat) => {
      const filtered = habits.filter((h) => h.category === cat);
      if (filtered.length > 0) acc[cat] = filtered;
      return acc;
    },
    {}
  );

  // ── Render ─────────────────────────────────────────────────────────────

  const maxWidth = step === 2 ? "max-w-2xl" : "max-w-md";

  return (
    <div className={`mx-auto w-full transition-all duration-300 ${maxWidth}`}>
      <StepIndicator current={step} />

      <div
        className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-xl transition-all duration-300 sm:p-8 ${
          visible && !animating ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        {/* ── Step 1: Dados pessoais ─────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className="mb-1 text-2xl font-bold text-white">Criar conta</h1>
            <p className="mb-6 text-sm text-gray-400">
              Seu personagem comeca aqui.
            </p>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-300">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="Seu nome de heroi"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                  }}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-300">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  placeholder="Minimo 8 caracteres"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                <PasswordRequirements password={password} />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
                )}
              </div>

              {/* Confirmar senha */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-gray-300"
                >
                  Confirmar senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword)
                      setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  placeholder="Repita sua senha"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {apiError && (
              <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {apiError}
              </p>
            )}

            <button
              type="button"
              onClick={handleStep1Continue}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 hover:shadow-purple-500/25 active:scale-[0.98]"
            >
              Continuar
            </button>

            <p className="mt-4 text-center text-sm text-gray-500">
              Ja tem conta?{" "}
              <Link
                href="/login"
                className="font-medium text-[var(--accent-primary)] transition-colors hover:text-purple-400"
              >
                Entre aqui
              </Link>
            </p>
          </>
        )}

        {/* ── Step 2: Selecao de habitos ─────────────────────────── */}
        {step === 2 && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Escolha seus habitos</h1>
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="text-sm text-gray-500 transition-colors hover:text-gray-300"
              >
                Voltar
              </button>
            </div>
            <p className="mb-5 text-sm text-gray-400">
              Seus habitos definem sua casa e atributos iniciais.
            </p>

            {/* Contador */}
            <div className="mb-5 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-4 py-2.5">
              <span className="text-sm text-gray-400">Selecionados</span>
              <span
                className={`text-sm font-bold ${
                  selectedIds.size >= 3 && selectedIds.size <= 10
                    ? "text-emerald-400"
                    : "text-gray-500"
                }`}
              >
                {selectedIds.size} de 3-10
              </span>
            </div>

            {habitsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                <span className="ml-3 text-sm text-gray-400">Carregando habitos...</span>
              </div>
            )}

            {habitsError && (
              <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {habitsError}
                <button
                  type="button"
                  onClick={() => {
                    setHabits([]);
                    setHabitsError("");
                  }}
                  className="ml-2 underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!habitsLoading && !habitsError && (
              <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
                {Object.entries(habitsByCategory).map(([category, categoryHabits]) => (
                  <div key={category}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${CATEGORY_BG[category as HabitCategory]}`}
                      />
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                        {CATEGORY_LABELS[category as HabitCategory]}
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {categoryHabits.map((habit) => (
                        <HabitCard
                          key={habit.id}
                          habit={habit}
                          selected={selectedIds.has(habit.id)}
                          onToggle={() => toggleHabit(habit.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {apiError && (
              <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {apiError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedIds.size < 3 || selectedIds.size > 10 || submitting}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 hover:shadow-purple-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Criando conta...
                </span>
              ) : (
                "Criar conta"
              )}
            </button>
          </>
        )}

        {/* ── Step 3: Resultado ──────────────────────────────────── */}
        {step === 3 && result && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-primary)]/20">
                <svg
                  className="h-7 w-7 text-[var(--accent-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Bem-vindo, {result.user.name}!</h1>
              <p className="mt-1 text-sm text-gray-400">Sua jornada comeca agora.</p>
            </div>

            {/* Casa */}
            <div className="mb-5 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-4">
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-[var(--accent-primary)]">
                Sua Casa
              </p>
              <h2 className="text-lg font-bold text-white">
                {result.user.house.name}
              </h2>
              <p className="mt-0.5 text-sm text-gray-300">
                Animal: <span className="font-medium text-white">{result.user.house.animal}</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                {result.user.house.description}
              </p>
            </div>

            {/* Atributos iniciais */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Atributos iniciais
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(result.character) as [keyof CharacterStats, number][])
                  .filter(([key]) => key in STAT_LABELS)
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[#0f0f1a] px-3 py-2.5 text-center"
                    >
                      <p className="text-lg font-bold text-white">{value}</p>
                      <p className="text-[11px] text-gray-500">{STAT_LABELS[key]}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 hover:shadow-purple-500/25 active:scale-[0.98]"
            >
              Ir para o jogo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
