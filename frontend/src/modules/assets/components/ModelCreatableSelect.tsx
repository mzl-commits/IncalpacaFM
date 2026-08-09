import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";

interface ModelCreatableSelectProps {
  taxonomyId: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelCreatableSelect({
  taxonomyId,
  value,
  onChange,
  error,
  placeholder = "Escribe o selecciona un modelo...",
  disabled = false,
}: ModelCreatableSelectProps) {
  const datalistId = useId();

  const query = useQuery({
    queryKey: ["taxonomy-models", taxonomyId],
    queryFn: async () => {
      if (!taxonomyId) return [];
      const { data } = await axios.get<string[]>(`/api/assets/taxonomy-models/?taxonomy_id=${taxonomyId}`);
      return data;
    },
    enabled: Boolean(taxonomyId),
    staleTime: 60000,
  });

  return (
    <>
      <input
        className={error ? "has-error" : ""}
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={query.isLoading ? "Cargando modelos..." : placeholder}
        disabled={disabled || query.isLoading || !taxonomyId}
        autoComplete="off"
      />
      <datalist id={datalistId}>
        {query.data?.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      {error && (
        <small className="field-error">
          <WarningCircle size={15} />
          {error}
        </small>
      )}
    </>
  );
}
