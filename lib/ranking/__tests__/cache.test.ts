import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache para evitar dependencia de runtime do Next.
// O wrapper deve invocar unstable_cache(fn, [baseKey], { revalidate, tags }).
const unstableCacheMock = vi.fn(
  <TArgs extends readonly unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
  ): ((...args: TArgs) => Promise<TResult>) => fn,
);

vi.mock("next/cache", () => ({
  unstable_cache: (...args: unknown[]) => unstableCacheMock(...args),
}));

import { cachedRanking } from "@/lib/ranking/cache";

beforeEach(() => {
  unstableCacheMock.mockReset();
  // Default passthrough
  unstableCacheMock.mockImplementation(
    <TArgs extends readonly unknown[], TResult>(
      fn: (...args: TArgs) => Promise<TResult>,
    ): ((...args: TArgs) => Promise<TResult>) => fn,
  );
});

describe("cachedRanking", () => {
  it("retorna uma funcao", () => {
    const wrapped = cachedRanking(async () => 1, "key");
    expect(typeof wrapped).toBe("function");
  });

  it("delega para unstable_cache com baseKey como key array", () => {
    const fn = async () => 42;
    cachedRanking(fn, "pvp-1v1:GLOBAL:50");

    expect(unstableCacheMock).toHaveBeenCalledTimes(1);
    const callArgs = unstableCacheMock.mock.calls[0];
    expect(callArgs?.[0]).toBe(fn);
    expect(callArgs?.[1]).toEqual(["pvp-1v1:GLOBAL:50"]);
  });

  it("usa TTL de 60s e tags ['ranking', 'ranking:<baseKey>']", () => {
    cachedRanking(async () => 0, "level:ARION:50");

    const options = unstableCacheMock.mock.calls[0]?.[2] as
      | { revalidate: number; tags: string[] }
      | undefined;
    expect(options?.revalidate).toBe(60);
    expect(options?.tags).toEqual(["ranking", "ranking:level:ARION:50"]);
  });

  it("a funcao retornada chama a funcao original com argumentos preservados", async () => {
    const inner = vi.fn(async (n: number, s: string) => ({ n, s }));
    const wrapped = cachedRanking(inner, "test");
    const result = await wrapped(7, "hello");

    expect(inner).toHaveBeenCalledWith(7, "hello");
    expect(result).toEqual({ n: 7, s: "hello" });
  });

  it("baseKeys distintas produzem chamadas distintas a unstable_cache", () => {
    cachedRanking(async () => 1, "a");
    cachedRanking(async () => 2, "b");

    expect(unstableCacheMock).toHaveBeenCalledTimes(2);
    expect(unstableCacheMock.mock.calls[0]?.[1]).toEqual(["a"]);
    expect(unstableCacheMock.mock.calls[1]?.[1]).toEqual(["b"]);
  });
});
