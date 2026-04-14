"use client";

type AlertBannerProps = {
  message: string;
  variant: "error" | "success" | "warning";
  onDismiss?: () => void;
  className?: string;
};

const variantConfig = {
  error: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    text: "#fca5a5",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="9" stroke="#fca5a5" strokeWidth="1.5" />
        <path
          d="M7 7l6 6M13 7l-6 6"
          stroke="#fca5a5"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  success: {
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.3)",
    text: "#6ee7b7",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="9" stroke="#6ee7b7" strokeWidth="1.5" />
        <path
          d="M6.5 10.5l2.5 2.5 5-5"
          stroke="#6ee7b7"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  warning: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
    text: "#fcd34d",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M10 2l8.66 15H1.34L10 2z"
          stroke="#fcd34d"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M10 8v4"
          stroke="#fcd34d"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="14.5" r="0.75" fill="#fcd34d" />
      </svg>
    ),
  },
} as const;

export default function AlertBanner({
  message,
  variant,
  onDismiss,
  className = "",
}: AlertBannerProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={`flex flex-row items-center gap-3 ${className}`}
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
      }}
    >
      <div className="shrink-0">{config.icon}</div>

      <p className="flex-1 text-sm">{message}</p>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar alerta"
          className="shrink-0 ml-auto cursor-pointer opacity-70 transition-opacity duration-150 hover:opacity-100"
          style={{ background: "none", border: "none", color: config.text }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
