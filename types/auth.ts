// types/auth.ts — Respostas de autenticacao

import type { UserWithHouse } from "./user";
import type { Character } from "./character";

/** Dados retornados nas rotas de auth (register e login) */
export type AuthResponse = {
  user: UserWithHouse;
  character: Character;
  accessToken: string;
};

/** Resposta de POST /api/auth/register (status 201) */
export type RegisterResponse = AuthResponse;

/** Resposta de POST /api/auth/login (status 200) */
export type LoginResponse = AuthResponse;
