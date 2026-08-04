import { ShieldWarning } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "./types";

export function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return (
      <section className="access-denied-page" role="alert">
        <ShieldWarning size={42} weight="duotone" />
        <h1>Acceso restringido</h1>
        <p>Tu perfil no tiene permisos para administrar la taxonomía de bienes.</p>
        <Link className="button button-primary" to="/">
          Volver al inicio
        </Link>
      </section>
    );
  }

  return children;
}
