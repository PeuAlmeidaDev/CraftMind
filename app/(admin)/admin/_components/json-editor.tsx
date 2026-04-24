"use client";

import { useState, useCallback } from "react";

type JsonEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export default function JsonEditor({ label, value, onChange, error }: JsonEditorProps) {
  const [isValid, setIsValid] = useState(() => {
    try { JSON.parse(value); return true; } catch { return false; }
  });

  const handleChange = useCallback(
    (newVal: string) => {
      onChange(newVal);
      try { JSON.parse(newVal); setIsValid(true); } catch { setIsValid(false); }
    },
    [onChange],
  );

  function handleFormat() {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
      setIsValid(true);
    } catch {
      // can't format invalid JSON
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isValid ? "text-emerald-400" : "text-red-400"}`}>
            {isValid ? "JSON Valido" : "JSON Invalido"}
          </span>
          <button
            type="button"
            onClick={handleFormat}
            disabled={!isValid}
            className="text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-gray-400 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            Formatar
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full bg-[var(--bg-secondary)] border ${
          error ? "border-red-500" : isValid ? "border-[var(--border-subtle)]" : "border-red-500/50"
        } rounded-lg px-3 py-2 text-sm text-white font-mono min-h-[120px] resize-y focus:outline-none focus:border-[var(--accent-primary)] transition-colors`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
