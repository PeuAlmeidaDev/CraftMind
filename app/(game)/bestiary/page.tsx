"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearAuthAndRedirect, authFetchOptions } from "@/lib/client-auth";
import EmberField from "@/components/ui/EmberField";
import BestiaryGrid from "./_components/BestiaryGrid";
import type { BestiaryResponse } from "@/types/cards";

export default function BestiaryPage() {
  const router = useRouter();
  const [data, setData] = useState<BestiaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearAuthAndRedirect(router);
      return;
    }

    const ac = new AbortController();

    async function fetchBestiary() {
      try {
        const res = await fetch("/api/bestiary", authFetchOptions(token!, ac.signal));

        if (res.status === 401) {
          clearAuthAndRedirect(router);
          return;
        }

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = (await res.json()) as { data: BestiaryResponse };
        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchBestiary();
    return () => ac.abort();
  }, [router]);

  if (loading) {
    return (
      <div className="relative">
        <EmberField />
        <div className="relative z-[2] flex flex-col gap-[18px]">
          <div
            className="h-20 animate-pulse"
            style={{
              background: "color-mix(in srgb, var(--gold) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
            }}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse"
                style={{
                  background: "color-mix(in srgb, var(--gold) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 10%, transparent)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <EmberField />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 15% 8%, color-mix(in srgb, var(--accent-primary) 12%, transparent) 0, transparent 55%),
            radial-gradient(ellipse at 88% 92%, color-mix(in srgb, var(--deep) 40%, transparent) 0, transparent 55%)`,
        }}
      />
      <div className="relative z-[2]">
        {data ? (
          <BestiaryGrid entries={data.entries} totals={data.totals} />
        ) : (
          <div
            className="py-12 text-center italic"
            style={{
              fontFamily: "var(--font-garamond)",
              color: "color-mix(in srgb, var(--gold) 60%, transparent)",
            }}
          >
            Nao foi possivel carregar o bestiario.
          </div>
        )}
      </div>
    </div>
  );
}
