export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"
      style={{
        backgroundImage: `
          radial-gradient(circle, rgba(124,58,237,0.15) 1px, transparent 1px),
          linear-gradient(to bottom right, var(--bg-primary), var(--bg-secondary), var(--bg-primary))
        `,
        backgroundSize: "40px 40px, 100% 100%",
      }}
    >
      <div className="w-full px-4 py-8">{children}</div>
    </div>
  );
}
