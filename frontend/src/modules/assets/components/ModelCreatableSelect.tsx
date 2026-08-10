import { WarningCircle } from "@phosphor-icons/react";
import { useModelList } from "@/modules/taxonomy/modelQueries";

interface ModelCreatableSelectProps {
  taxonomyId: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelCreatableSelect({
  value,
  onChange,
  error,
  placeholder = "Selecciona un modelo...",
  disabled = false,
}: ModelCreatableSelectProps) {
  const query = useModelList();
  const models = query.data?.filter(m => m.isActive) ?? [];

  return (
    <>
      <select
        className={error ? "has-error" : ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || query.isLoading}
      >
        <option value="" disabled>
          {query.isLoading ? "Cargando modelos..." : placeholder}
        </option>
        {models.map((model) => (
          <option key={model.id} value={model.name}>
            {model.brand} - {model.name}
          </option>
        ))}
      </select>
      {error && (
        <small className="field-error">
          <WarningCircle size={15} />
          {error}
        </small>
      )}
    </>
  );
}
