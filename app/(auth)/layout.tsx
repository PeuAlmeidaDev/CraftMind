"use client";

import EmberField from "@/components/ui/EmberField";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center"
      style={{
        backgroundColor: "var(--bg-primary)",
        backgroundImage:
          "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent 70%)",
      }}
    >
      <EmberField />
      <div className="relative z-10 w-full px-4 py-8">{children}</div>
    </div>
  );
}
