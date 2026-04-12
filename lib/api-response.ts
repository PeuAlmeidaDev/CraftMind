import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface SuccessBody<T> {
  data: T;
  message?: string;
}

interface ErrorBody {
  error: string;
  code: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna uma resposta JSON padronizada de sucesso.
 *
 * Formato: `{ data: T, message?: string }`
 */
export function apiSuccess<T>(
  data: T,
  status = 200,
  message?: string
): NextResponse<SuccessBody<T>> {
  const body: SuccessBody<T> = { data };
  if (message !== undefined) {
    body.message = message;
  }
  return NextResponse.json(body, { status });
}

/**
 * Retorna uma resposta JSON padronizada de erro.
 *
 * Formato: `{ error: string, code: string }`
 */
export function apiError(
  error: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse<ErrorBody> {
  const body: ErrorBody = { error, code };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}
