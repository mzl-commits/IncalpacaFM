import { WarningCircle } from "@phosphor-icons/react";

export function Field({
  label,
  required,
  hint,
  error,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && (
        <small className="field-error">
          <WarningCircle size={14} />
          {error}
        </small>
      )}
    </label>
  );
}