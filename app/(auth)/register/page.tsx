"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Habit, HabitCategory, ApiSuccess, House, HabitSummary } from "@/types";
import { PasswordRequirements } from "./_components/PasswordRequirements";
import { StepIndicator } from "./_components/StepIndicator";
import { HabitCard } from "./_components/HabitCard";
import { useFingerprint } from "../_lib/use-fingerprint";

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

// ── Corner ticks helper ────────────────────────────────────────────────────

function CornerTicks() {
  return (
    <>
      {[
        { top: -1, left: -1 },
        { top: -1, right: -1 },
        { bottom: -1, left: -1 },
        { bottom: -1, right: -1 },
      ].map((pos, i) => (
        <span key={i} className="pointer-events-none absolute h-2.5 w-2.5" style={{
          ...pos,
          borderTop: pos.top !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
          borderBottom: pos.bottom !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
          borderLeft: pos.left !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
          borderRight: pos.right !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
        }} />
      ))}
    </>
  );
}

// ── Main page component ────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { visitorId, ready: fingerprintReady } = useFingerprint();

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
          visitorId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errBody = json as { error: string };
        setApiError(errBody.error || "Erro desconhecido");
        return;
      }

      const data = (json as ApiSuccess<RegisterResult>).data;

      // O backend ja seta o cookie httpOnly access_token via Set-Cookie.
      // Mantemos localStorage apenas porque as paginas (game)/ ainda leem
      // daqui para montar o header Authorization.
      localStorage.setItem("access_token", data.accessToken);

      setPassword("");
      setConfirmPassword("");
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
        className={`relative p-6 transition-all duration-300 sm:p-8 ${
          visible && !animating ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={{
          background: "linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))",
          border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
        }}
      >
        <CornerTicks />

        {/* ── Step 1: Dados pessoais ─────────────────────────────── */}
        {step === 1 && (
          <>
            <h1
              className="mb-1 text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Criar conta
            </h1>
            <p
              className="mb-6 text-sm"
              style={{
                fontFamily: "var(--font-garamond)",
                fontStyle: "italic",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Seu personagem comeca aqui.
            </p>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }}
                >
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
                  className="w-full px-4 py-2.5 text-sm text-gray-100 outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                    fontFamily: "var(--font-garamond)",
                  }}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }}
                >
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
                  className="w-full px-4 py-2.5 text-sm text-gray-100 outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                    fontFamily: "var(--font-garamond)",
                  }}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }}
                >
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
                  className="w-full px-4 py-2.5 text-sm text-gray-100 outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                    fontFamily: "var(--font-garamond)",
                  }}
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
                  className="mb-1.5 block text-sm font-medium"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                  }}
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
                  className="w-full px-4 py-2.5 text-sm text-gray-100 outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                    fontFamily: "var(--font-garamond)",
                  }}
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {apiError && (
              <p
                className="mt-4 px-3 py-2 text-sm text-red-400"
                style={{ backgroundColor: "color-mix(in srgb, red 10%, transparent)" }}
              >
                {apiError}
              </p>
            )}

            <button
              type="button"
              onClick={handleStep1Continue}
              className="mt-6 w-full px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--ember), var(--accent-primary))",
                border: "1px solid color-mix(in srgb, var(--ember) 50%, transparent)",
                fontFamily: "var(--font-cormorant)",
                fontSize: "15px",
                letterSpacing: "0.05em",
              }}
            >
              Continuar
            </button>

            <p
              className="mt-4 text-center text-sm"
              style={{
                fontFamily: "var(--font-garamond)",
                fontStyle: "italic",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Ja tem conta?{" "}
              <Link
                href="/login"
                className="transition-colors"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "color-mix(in srgb, var(--gold) 90%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "color-mix(in srgb, var(--gold) 60%, transparent)";
                }}
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
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                Escolha seus habitos
              </h1>
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="text-sm transition-colors"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "color-mix(in srgb, var(--gold) 80%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "color-mix(in srgb, var(--gold) 50%, transparent)";
                }}
              >
                Voltar
              </button>
            </div>
            <p
              className="mb-5 text-sm"
              style={{
                fontFamily: "var(--font-garamond)",
                fontStyle: "italic",
                color: "color-mix(in srgb, var(--gold) 50%, transparent)",
              }}
            >
              Seus habitos definem sua casa e atributos iniciais.
            </p>

            {/* Contador */}
            <div
              className="mb-5 flex items-center justify-between px-4 py-2.5"
              style={{
                backgroundColor: "var(--bg-primary)",
                border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
              }}
            >
              <span
                className="text-sm"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                }}
              >
                Selecionados
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  color:
                    selectedIds.size >= 3 && selectedIds.size <= 10
                      ? "var(--ember)"
                      : "color-mix(in srgb, var(--gold) 40%, transparent)",
                }}
              >
                {selectedIds.size} de 3-10
              </span>
            </div>

            {habitsLoading && (
              <div className="flex items-center justify-center py-12">
                <div
                  className="h-6 w-6 animate-spin border-2 border-t-transparent"
                  style={{ borderColor: "var(--ember)", borderTopColor: "transparent" }}
                />
                <span
                  className="ml-3 text-sm"
                  style={{
                    fontFamily: "var(--font-garamond)",
                    fontStyle: "italic",
                    color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                  }}
                >
                  Carregando habitos...
                </span>
              </div>
            )}

            {habitsError && (
              <div
                className="px-4 py-3 text-sm text-red-400"
                style={{ backgroundColor: "color-mix(in srgb, red 10%, transparent)" }}
              >
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
                        className={`h-1.5 w-1.5 ${CATEGORY_BG[category as HabitCategory]}`}
                      />
                      <h2
                        className="text-sm font-semibold uppercase tracking-wide"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          fontSize: "10px",
                          letterSpacing: "0.2em",
                          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                        }}
                      >
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
              <p
                className="mt-4 px-3 py-2 text-sm text-red-400"
                style={{ backgroundColor: "color-mix(in srgb, red 10%, transparent)" }}
              >
                {apiError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedIds.size < 3 || selectedIds.size > 10 || submitting || !fingerprintReady}
              className="mt-6 w-full px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              style={{
                background: "linear-gradient(135deg, var(--ember), var(--accent-primary))",
                border: "1px solid color-mix(in srgb, var(--ember) 50%, transparent)",
                fontFamily: "var(--font-cormorant)",
                fontSize: "15px",
                letterSpacing: "0.05em",
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin border-2 border-white border-t-transparent"
                  />
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
              <div
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center"
                style={{ backgroundColor: "color-mix(in srgb, var(--ember) 15%, transparent)" }}
              >
                <svg
                  className="h-7 w-7"
                  style={{ color: "var(--ember)" }}
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
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                Bem-vindo, {result.user.name}!
              </h1>
              <p
                className="mt-1 text-sm"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                }}
              >
                Sua jornada comeca agora.
              </p>
            </div>

            {/* Casa */}
            <div
              className="relative mb-5 p-4"
              style={{
                border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 5%, transparent)",
              }}
            >
              <p
                className="mb-0.5 text-xs font-medium uppercase"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "9px",
                  letterSpacing: "0.3em",
                  color: "var(--ember)",
                }}
              >
                Sua Casa
              </p>
              <h2
                className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                {result.user.house.name}
              </h2>
              <p
                className="mt-0.5 text-sm"
                style={{
                  fontFamily: "var(--font-garamond)",
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                }}
              >
                Animal: <span className="font-medium text-white">{result.user.house.animal}</span>
              </p>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--gold) 50%, transparent)",
                }}
              >
                {result.user.house.description}
              </p>
            </div>

            {/* Atributos iniciais */}
            <div className="mb-6">
              <h3
                className="mb-3 text-sm font-semibold uppercase tracking-wide"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                }}
              >
                Atributos iniciais
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(result.character) as [keyof CharacterStats, number][])
                  .filter(([key]) => key in STAT_LABELS)
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="px-3 py-2.5 text-center"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
                      }}
                    >
                      <p
                        className="text-lg font-bold text-white"
                        style={{ fontFamily: "var(--font-jetbrains)" }}
                      >
                        {value}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          fontSize: "8px",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "color-mix(in srgb, var(--gold) 45%, transparent)",
                        }}
                      >
                        {STAT_LABELS[key]}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--ember), var(--accent-primary))",
                border: "1px solid color-mix(in srgb, var(--ember) 50%, transparent)",
                fontFamily: "var(--font-cormorant)",
                fontSize: "15px",
                letterSpacing: "0.05em",
              }}
            >
              Ir para o jogo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
