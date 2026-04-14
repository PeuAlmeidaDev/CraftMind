"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LoginResponse } from "@/types/auth";
import type { ApiSuccess, ApiError } from "@/types/api";
import RPGInput from "@/components/ui/RPGInput";
import RPGButton from "@/components/ui/RPGButton";
import AlertBanner from "@/components/ui/AlertBanner";
import "./login-animations.css";

export default function LoginPage() {
  const router = useRouter();

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
        body: JSON.stringify({ email: email.trim(), password }),
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
        <h1
          className="mb-2 text-4xl font-bold sm:text-5xl"
          style={{
            background: "linear-gradient(135deg, var(--accent-primary), #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Craft Mind
        </h1>
        <p className="mb-10 text-sm" style={{ color: "#71717a" }}>
          Forje sua mente, domine a batalha
        </p>
      </div>

      {/* Card do formulario */}
      <div
        className="animate-fade-in-up animate-delay-150 relative w-full max-w-[420px] rounded-2xl p-6 sm:p-10"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 0 40px rgba(124,58,237,0.06)",
          transition: "box-shadow 400ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 0 60px rgba(124,58,237,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 0 40px rgba(124,58,237,0.06)";
        }}
      >
        {/* Borda superior decorativa */}
        <div className="login-card-border-glow" />

        <h2 className="mb-2 text-xl font-bold text-white sm:text-2xl">
          Entrar
        </h2>
        <p className="mb-6 text-sm" style={{ color: "#71717a" }}>
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
            >
              Entrar
            </RPGButton>
          </div>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: "#71717a" }}>
          Ainda nao tem conta?{" "}
          <Link
            href="/register"
            className="transition-colors hover:underline"
            style={{ color: "var(--accent-primary)" }}
          >
            Criar conta
          </Link>
        </p>
      </div>

      {/* Rodape */}
      <p
        className="animate-fade-in-up animate-delay-300 mt-8 text-xs"
        style={{ color: "#52525b" }}
      >
        Craft Mind v0.1 — Forjando habitos em poder
      </p>
    </div>
  );
}
