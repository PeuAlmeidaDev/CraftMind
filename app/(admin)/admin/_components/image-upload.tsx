"use client";

import { useState, useRef, useEffect } from "react";

type ImageUploadProps = {
  currentImageUrl?: string;
  onFileSelect: (file: File | null) => void;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export default function ImageUpload({ currentImageUrl, onFileSelect }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(file: File | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);

    if (!file) {
      onFileSelect(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Tipo invalido. Aceitos: JPEG, PNG, WebP");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("Arquivo excede 5MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onFileSelect(file);
  }

  const displayUrl = previewUrl ?? currentImageUrl ?? null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">Imagem</label>

      {displayUrl ? (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt="Preview"
            className="w-32 h-32 rounded-lg object-cover border border-[var(--border-subtle)]"
          />
          <button
            type="button"
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-700 cursor-pointer"
          >
            X
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-lg border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center text-gray-500 hover:border-[var(--accent-primary)] hover:text-gray-300 transition-colors cursor-pointer"
        >
          <span className="text-sm">Clique para selecionar imagem</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
