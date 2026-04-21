import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Client IP extraction
// ---------------------------------------------------------------------------

/**
 * Extrai o IP real do cliente de forma segura.
 * Prioridade: x-real-ip (confiavel em Vercel/Nginx) > x-forwarded-for primeiro IP > fallback.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

// ---------------------------------------------------------------------------
// Lazy Redis initialization
// ---------------------------------------------------------------------------

let redisInstance: Redis | null = null;
let warnedMissingConfig = false;

function getRedisInstance(): Redis | null {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warnedMissingConfig) {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN nao configuradas. " +
          "Rate limiting desativado (no-op). Configure as variaveis de ambiente para ativar."
      );
      warnedMissingConfig = true;
    }
    return null;
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  maxRequests?: number;
  window?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

// ---------------------------------------------------------------------------
// No-op result (when Redis is not available)
// ---------------------------------------------------------------------------

const NOOP_RESULT: RateLimitResult = {
  success: true,
  remaining: Infinity,
  reset: 0,
};

const FAIL_CLOSED_RESULT: RateLimitResult = {
  success: false,
  remaining: 0,
  reset: 0,
};

const isDev = process.env.NODE_ENV === "development";

/** Retorna fail-open (NOOP) em dev, fail-closed em produção. Loga erro em produção. */
function failSafeResult(context: string, error?: unknown): RateLimitResult {
  if (isDev) {
    return NOOP_RESULT;
  }
  console.error(`[${context}] Redis indisponivel — fail-close ativado (requests bloqueados).`, error ?? "");
  return { ...FAIL_CLOSED_RESULT, reset: Date.now() + 60_000 };
}

// ---------------------------------------------------------------------------
// Generic rate limiter
// ---------------------------------------------------------------------------

/**
 * Verifica rate limit para um identificador (ex: IP, userId).
 * Usa sliding window do @upstash/ratelimit.
 *
 * Se Upstash nao estiver configurado: em dev retorna sucesso (no-op), em producao bloqueia a request (fail-close).
 *
 * @param identifier - Chave unica do cliente (IP, user ID, etc.)
 * @param config - Configuracao opcional (padrao: 5 req / 60s)
 */
export async function rateLimit(
  identifier: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisInstance();
  if (!redis) return failSafeResult("rate-limit");

  const maxRequests = config?.maxRequests ?? 5;
  const window = config?.window ?? "60 s";

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      maxRequests,
      window as Parameters<typeof Ratelimit.slidingWindow>[1]
    ),
    analytics: false,
    prefix: "craft-mind:rl",
  });

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    return failSafeResult("rate-limit", error);
  }
}

// ---------------------------------------------------------------------------
// Auth rate limiter (pre-configured: 5 req / 60s)
// ---------------------------------------------------------------------------

let authLimiterInstance: Ratelimit | null = null;

function getAuthLimiter(): Ratelimit | null {
  if (authLimiterInstance) return authLimiterInstance;

  const redis = getRedisInstance();
  if (!redis) return null;

  authLimiterInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: false,
    prefix: "craft-mind:auth-rl",
  });

  return authLimiterInstance;
}

/** Rate limiting pre-configurado para rotas de auth: 5 tentativas por 60s */
export async function authRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getAuthLimiter();
  if (!limiter) return failSafeResult("auth-rate-limit");

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    return failSafeResult("auth-rate-limit", error);
  }
}

// ---------------------------------------------------------------------------
// Battle action rate limiter (pre-configured: 1 req / 2s per user)
// ---------------------------------------------------------------------------

let battleLimiterInstance: Ratelimit | null = null;

function getBattleLimiter(): Ratelimit | null {
  if (battleLimiterInstance) return battleLimiterInstance;

  const redis = getRedisInstance();
  if (!redis) return null;

  battleLimiterInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "2 s"),
    analytics: false,
    prefix: "craft-mind:battle-rl",
  });

  return battleLimiterInstance;
}

/** Rate limiting pre-configurado para acoes de batalha: 1 req por 2s por usuario */
export async function battleActionRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getBattleLimiter();
  if (!limiter) return failSafeResult("battle-rate-limit");

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    return failSafeResult("battle-rate-limit", error);
  }
}
