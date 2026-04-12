"use client";

interface RPGInputProps {
  label: string;
  type: string;
  id: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  autoComplete?: string;
}

export default function RPGInput({
  label,
  type,
  id,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  autoComplete,
}: RPGInputProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium"
        style={{ color: "#a1a1aa" }}
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: `1px solid ${error ? "#ef4444" : "var(--border-subtle)"}`,
          borderRadius: "8px",
          padding: "12px 16px",
          color: "#ffffff",
          fontSize: "0.938rem",
        }}
        onFocus={(e) => {
          if (!error) {
            e.currentTarget.style.borderColor = "var(--accent-primary)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px rgba(124,58,237,0.15)";
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? "#ef4444"
            : "var(--border-subtle)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {error && (
        <p id={errorId} className="text-sm" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      <style>{`
        #${id}::placeholder {
          color: #4a4a5a;
        }
      `}</style>
    </div>
  );
}
