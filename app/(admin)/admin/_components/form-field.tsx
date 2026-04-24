"use client";

type FormFieldProps = {
  label: string;
  name: string;
  type: "text" | "number" | "textarea" | "select";
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
};

const inputClass = "w-full bg-[var(--bg-secondary)] border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent-primary)] transition-colors";

export default function FormField({
  label,
  name,
  type,
  value,
  onChange,
  error,
  options,
  placeholder,
  min,
  max,
  required,
}: FormFieldProps) {
  const borderColor = error ? "border-red-500" : "border-[var(--border-subtle)]";

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`${inputClass} ${borderColor} min-h-[80px] resize-y`}
        />
      ) : type === "select" ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`${inputClass} ${borderColor} cursor-pointer`}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          required={required}
          className={`${inputClass} ${borderColor}`}
        />
      )}

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
