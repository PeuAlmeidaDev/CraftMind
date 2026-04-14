/** Indicador visual dos requisitos de senha */
export function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "8+ caracteres", met: password.length >= 8 },
    { label: "1 letra maiuscula", met: /[A-Z]/.test(password) },
    { label: "1 numero", met: /[0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {requirements.map((req) => (
        <span
          key={req.label}
          className={`text-xs transition-colors duration-200 ${
            req.met ? "text-emerald-400" : "text-gray-500"
          }`}
        >
          <span className="mr-1">{req.met ? "\u2713" : "\u2022"}</span>
          {req.label}
        </span>
      ))}
    </div>
  );
}
