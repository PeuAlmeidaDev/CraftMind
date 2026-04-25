"use client";

import type { ReactNode, CSSProperties } from "react";

export default function Panel({
  children,
  title,
  right,
  style,
}: {
  children: ReactNode;
  title?: string;
  right?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className="relative border border-[var(--border-subtle)] p-5"
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        ...style,
      }}
    >
      {/* Corner ticks */}
      {[
        { top: -1, left: -1 },
        { top: -1, right: -1 },
        { bottom: -1, left: -1 },
        { bottom: -1, right: -1 },
      ].map((pos, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-2.5 w-2.5"
          style={{
            ...pos,
            borderTop: pos.top !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
            borderBottom: pos.bottom !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
            borderLeft: pos.left !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
            borderRight: pos.right !== undefined ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "none",
          }}
        />
      ))}

      {(title || right) && (
        <header
          className="mb-3.5 flex items-baseline justify-between border-b pb-2.5"
          style={{ borderColor: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
        >
          <span
            className="text-[10px] font-medium uppercase tracking-[0.35em]"
            style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
          >
            {title}
          </span>
          {right && (
            <span
              className="text-[10px] uppercase tracking-[0.35em]"
              style={{ fontFamily: "var(--font-cinzel)", color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}
            >
              {right}
            </span>
          )}
        </header>
      )}

      {children}
    </section>
  );
}
