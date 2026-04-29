"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Counts = { skills: number; mobs: number; cards: number } | null;

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/skills").then((r) => r.json()),
      fetch("/api/admin/mobs").then((r) => r.json()),
      fetch("/api/admin/cards").then((r) => r.json()),
    ])
      .then(([skillsRes, mobsRes, cardsRes]) => {
        setCounts({
          skills: Array.isArray(skillsRes.data) ? skillsRes.data.length : 0,
          mobs: Array.isArray(mobsRes.data) ? mobsRes.data.length : 0,
          cards: Array.isArray(cardsRes.data) ? cardsRes.data.length : 0,
        });
      })
      .catch(() => setCounts({ skills: 0, mobs: 0, cards: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }

  const cards = [
    { label: "Skills", count: counts?.skills ?? 0, href: "/admin/skills" },
    { label: "Mobs", count: counts?.mobs ?? 0, href: "/admin/mobs" },
    { label: "Cards", count: counts?.cards ?? 0, href: "/admin/cards" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 hover:border-[var(--accent-primary)]/50 transition-colors"
          >
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className="text-3xl font-bold text-white mt-2">{card.count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
