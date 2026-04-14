// lib/auth/set-auth-cookies.ts — Helper centralizado para cookies de autenticacao

import { NextResponse } from "next/server";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias
const ACCESS_TOKEN_MAX_AGE = 60 * 15; // 15 minutos

/**
 * Define o cookie de refresh token na resposta.
 * Atributos: httpOnly, secure (prod), sameSite strict, path /api/auth.
 */
export function setRefreshTokenCookie(
  response: NextResponse,
  refreshToken: string
): void {
  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Define o cookie de access token na resposta.
 * Atributos: httpOnly, secure (prod), sameSite strict, path /.
 */
export function setAccessTokenCookie(
  response: NextResponse,
  accessToken: string
): void {
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

/**
 * Limpa ambos os cookies de autenticacao (logout).
 * Usa maxAge 0 com os mesmos atributos usados na criacao.
 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set("access_token", "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });
}
