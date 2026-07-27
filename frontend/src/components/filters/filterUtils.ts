import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { FilterOption } from "./ListFilterPanel";

type FilterValues<T extends readonly string[]> = {
  [Key in T[number]]: string;
};

export function useListFilterParams<const T extends readonly string[]>(keys: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(
    () =>
      Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? ""])) as FilterValues<T>,
    [keys, searchParams],
  );

  const setValue = useCallback(
    (key: T[number], value: string) => {
      const next = new URLSearchParams(window.location.search);
      const normalized = value.trim();

      if (normalized) {
        next.set(key, normalized);
      } else {
        next.delete(key);
      }

      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    keys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [keys, setSearchParams]);

  return { values, setValue, clearFilters };
}

export function buildFilterOptions(
  values: Array<string | null | undefined>,
  labels: Record<string, string> = {},
): FilterOption[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts, ([value, count]) => ({
    value,
    label: labels[value] ?? value,
    count,
  })).sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export function isDateInRange(value: string, from: string, to: string) {
  if (!value) return false;
  const day = value.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

export function labelFor(value: string, labels: Record<string, string>, fallback = value) {
  return labels[value] ?? fallback;
}
