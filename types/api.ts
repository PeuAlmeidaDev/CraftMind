// types/api.ts — Tipos genericos de resposta da API

/** Resposta de sucesso padrao: { data: T, message?: string } */
export type ApiSuccess<T> = {
  data: T;
  message?: string;
};

/** Resposta de erro padrao: { error: string, code?: string } */
export type ApiError = {
  error: string;
  code?: string;
};
