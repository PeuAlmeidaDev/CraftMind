"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LoginResponse } from "@/types/auth";
import type { ApiSuccess, ApiError } from "@/types/api";
import RPGInput from "@/components/ui/RPGInput";
import RPGButton from "@/components/ui/RPGButton";
import AlertBanner from "@/components/ui/AlertBanner";
import { useFingerprint } from "../_lib/use-fingerprint";
import "./login-animations.css";

export default function LoginPage() {
  const router = useRouter();
  const { visitorId, ready: fingerprintReady } = useFingerprint();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateFields(): string | null {
    if (!email.trim()) return "Preencha o e-mail.";
    if (!password) return "Preencha a senha.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const validationError = validateFields();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, visitorId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;

        if (res.status === 429) {
          setError(body?.error ?? "Muitas tentativas. Tente novamente mais tarde.");
        } else if (res.status === 401) {
          setError(body?.error ?? "Credenciais invalidas.");
        } else if (res.status === 422) {
          setError(body?.error ?? "Dados invalidos.");
        } else {
          setError("Erro ao fazer login. Tente novamente.");
        }

        setLoading(false);
        return;
      }

      const { data } = (await res.json()) as ApiSuccess<LoginResponse>;

      // O backend ja seta o cookie httpOnly access_token via Set-Cookie.
      // Mantemos localStorage apenas porque as paginas (game)/ ainda leem
      // daqui para montar o header Authorization. Quando todas migrarem
      // para cookie-only, remover esta linha.
      localStorage.setItem("access_token", data.accessToken);

      setPassword("");
      router.push("/dashboard");
    } catch {
      setError("Erro de conexao. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-4">
      {/* Titulo e subtitulo */}
      <div className="animate-fade-in-up text-center">
        {/* Eyebrow */}
        <p
          className="mb-3 text-[9px] uppercase"
          style={{
            fontFamily: "var(--font-cinzel)",
            letterSpacing: "0.4em",
            color: "color-mix(in srgb, var(--gold) 50%, transparent)",
          }}
        >
          FORJA DO DESTINO
        </p>

        <h1 className="mb-2 text-5xl sm:text-6xl" style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic" }}>
          <span style={{ color: "var(--ember)" }}>Craft</span>{" "}
          <span className="text-white">Mind</span>
        </h1>

        <p
          className="mb-10 text-sm"
          style={{
            fontFamily: "var(--font-garamond)",
            fontStyle: "italic",
            color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          }}
        >
          Forje sua mente, domine a batalha
        </p>
      </div>

      {/* Card do formulario */}
      <div
        className="animate-fade-in-up animate-delay-150 relative w-full max-w-[420px] p-6 sm:p-10"
        style={{
          background: "linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))",
          border: "1px solid color-mix(in srgb, var(--gold) 15%, transparent)",
        }}
      >
        {/* Corner ticks */}
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

        <h2
          className="mb-2 text-xl font-bold text-white sm:text-2xl"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Entrar
        </h2>
        <p
          className="mb-6 text-sm"
          style={{
            fontFamily: "var(--font-garamond)",
            fontStyle: "italic",
            color: "color-mix(in srgb, var(--gold) 50%, transparent)",
          }}
        >
          Acesse sua conta para continuar
        </p>

        {error && (
          <AlertBanner
            message={error}
            variant="error"
            onDismiss={() => setError("")}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit}>
          <RPGInput
            label="E-mail"
            type="email"
            id="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />

          <div className="mt-4">
            <RPGInput
              label="Senha"
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <div className="mt-6">
            <RPGButton
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={!fingerprintReady}
            >
              Entrar
            </RPGButton>
          </div>
        </form>

        <p
          className="mt-4 text-center text-sm"
          style={{
            fontFamily: "var(--font-garamond)",
            fontStyle: "italic",
            color: "color-mix(in srgb, var(--gold) 50%, transparent)",
          }}
        >
          Ainda nao tem conta?{" "}
          <Link
            href="/register"
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
            Criar conta
          </Link>
        </p>
      </div>

      {/* Rodape */}
      <p
        className="animate-fade-in-up animate-delay-300 mt-8 text-xs"
        style={{
          color: "color-mix(in srgb, var(--gold) 30%, transparent)",
          fontFamily: "var(--font-garamond)",
        }}
      >
        Craft Mind v0.1 — Forjando habitos em poder
      </p>
    </div>
  );
}
