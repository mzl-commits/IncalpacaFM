import { Navigate, useLocation } from "react-router-dom";

export function LegacyLifecycleRedirect() {
  const { pathname, search, hash } = useLocation();
  const target = pathname.replace(/^\/ciclo-vida/, "/bienes/ciclo-vida");
  return <Navigate to={`${target}${search}${hash}`} replace />;
}
