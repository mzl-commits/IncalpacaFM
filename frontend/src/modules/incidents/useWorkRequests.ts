import { useState, useEffect, useCallback, useMemo } from "react";
import { listWorkRequests, WORK_REQUESTS_UPDATED_EVENT } from "./incidentRepository";
import { requestPriorityLabels, requestStatusLabels, requestTypeLabels } from "./incidentModel";
import type { WorkRequest } from "./types";

export interface FilterValues {
  q: string;
  status: string;
  priority: string;
  type: string;
  building: string;
  project: string;
  evidence: string;
  from: string;
  to: string;
}

const initialValues: FilterValues = {
  q: "",
  status: "",
  priority: "",
  type: "",
  building: "",
  project: "",
  evidence: "",
  from: "",
  to: "",
};

export function useWorkRequests() {
  const [allRequests, setAllRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<FilterValues>(initialValues);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listWorkRequests();
      setAllRequests(data);
    } catch {
      setAllRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const handleUpdate = () => { void loadRequests(); };
    window.addEventListener(WORK_REQUESTS_UPDATED_EVENT, handleUpdate);
    return () => { window.removeEventListener(WORK_REQUESTS_UPDATED_EVENT, handleUpdate); };
  }, [loadRequests]);

  const setValue = useCallback((key: keyof FilterValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setValues(initialValues);
  }, []);

  const requests = useMemo(() => {
    return allRequests.filter((req) => {
      if (values.q) {
        const search = values.q.toLowerCase();
        const matchesQ =
          (req.code && req.code.toLowerCase().includes(search)) ||
          (req.requesterName && req.requesterName.toLowerCase().includes(search)) ||
          (req.description && req.description.toLowerCase().includes(search)) ||
          (req.building && req.building.toLowerCase().includes(search)) ||
          (req.assetCode && req.assetCode.toLowerCase().includes(search)) ||
          (req.assetName && req.assetName.toLowerCase().includes(search));
        if (!matchesQ) return false;
      }
      if (values.status && req.status !== values.status) return false;
      if (values.priority && req.requesterPriority !== values.priority) return false;
      if (values.type && req.requestType !== values.type) return false;
      if (values.building && req.building !== values.building) return false;
      if (values.from) {
        const reqDate = new Date(req.reportedAt);
        const fromDate = new Date(values.from);
        if (reqDate < fromDate) return false;
      }
      if (values.to) {
        const reqDate = new Date(req.reportedAt);
        const toDate = new Date(values.to);
        toDate.setHours(23, 59, 59, 999);
        if (reqDate > toDate) return false;
      }
      return true;
    });
  }, [allRequests, values]);

  const statusOptions = useMemo(() => {
    return Object.entries(requestStatusLabels).map(([value, label]) => ({ value, label }));
  }, []);

  const priorityOptions = useMemo(() => {
    return Object.entries(requestPriorityLabels).map(([value, label]) => ({ value, label }));
  }, []);

  const typeOptions = useMemo(() => {
    return Object.entries(requestTypeLabels).map(([value, label]) => ({ value, label }));
  }, []);

  const buildingOptions = useMemo(() => {
    const uniqueBuildings = Array.from(new Set(allRequests.map((r) => r.building).filter(Boolean)));
    return uniqueBuildings.map((b) => ({ value: b, label: b }));
  }, [allRequests]);

  return {
    requests,
    allRequests,
    loading,
    values,
    setValue,
    clearFilters,
    statusOptions,
    priorityOptions,
    typeOptions,
    buildingOptions,
    loadRequests,
  };
}
