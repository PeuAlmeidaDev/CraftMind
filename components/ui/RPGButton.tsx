"use client";

type RPGButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  className?: string;
};

export default function RPGButton({
  children,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  fullWidth = false,
  className = "",
}: RPGButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all duration-200 outline-none";

  const variantStyles =
    variant === "primary"
      ? "text-white"
      : "bg-transparent text-[var(--accent-primary)]";

  const sizeStyles = fullWidth ? "w-full" : "";

  const stateStyles = isDisabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${stateStyles} ${className}`}
      style={{
        padding: "12px 24px",
        borderRadius: "8px",
        ...(variant === "primary"
          ? {
              background:
                "linear-gradient(135deg, var(--accent-primary), #6d28d9)",
              border: "none",
            }
          : {
              background: "transparent",
              border: "1px solid var(--accent-primary)",
            }),
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        if (variant === "primary") {
          el.style.filter = "brightness(1.15)";
          el.style.transform = "translateY(-1px)";
          el.style.boxShadow = "0 4px 15px rgba(124,58,237,0.3)";
        } else {
          el.style.backgroundColor = "rgba(124,58,237,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        el.style.filter = "";
        el.style.transform = "";
        el.style.boxShadow = "";
        if (variant === "secondary") {
          el.style.backgroundColor = "transparent";
        }
      }}
      onMouseDown={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow =
          variant === "primary" ? "0 2px 8px rgba(124,58,237,0.2)" : "";
      }}
      onMouseUp={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        if (variant === "primary") {
          el.style.transform = "translateY(-1px)";
          el.style.boxShadow = "0 4px 15px rgba(124,58,237,0.3)";
        }
      }}
    >
      {loading && (
        <div
          className="animate-spin rounded-full"
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#ffffff",
          }}
        />
      )}
      {children}
    </button>
  );
}
