import { LockKey, ShieldCheck, User } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workerCode, setWorkerCode] = useState("admin");
  const [password, setPassword] = useState("Montescoli3");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login({ workerCode: workerCode.trim(), password });
      navigate((location.state as { from?: string } | null)?.from ?? "/", {
        replace: true,
      });
    } catch {
      setError("No pudimos iniciar sesión. Verifica el código y la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-mark">SG</div>
        <span>Sistema de Gestión y Trazabilidad de Bienes</span>
        <h1>Control ejecutivo con trazabilidad operativa.</h1>
        <p>Acceso seguro para Facility Management y personal técnico autorizado.</p>
        <div className="login-security-note">
          <ShieldCheck size={24} weight="duotone" />
          <span>
            <strong>Sesión protegida</strong>
            <small>Los permisos se validan también en el servidor.</small>
          </span>
        </div>
      </section>

      <section className="login-form-panel">
        <form onSubmit={handleSubmit}>
          <header>
            <span>SGTB Incalpaca</span>
            <h2>Iniciar sesión</h2>
            <p>Ingresa con el código de trabajador asignado.</p>
          </header>
          {error && <div className="login-error" role="alert">{error}</div>}
          <label className="login-field">
            <span>Código de trabajador</span>
            <div>
              <User size={19} />
              <input
                autoComplete="username"
                value={workerCode}
                onChange={(event) => setWorkerCode(event.target.value)}
                required
              />
            </div>
          </label>
          <label className="login-field">
            <span>Contraseña</span>
            <div>
              <LockKey size={19} />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </label>
          <button className="button button-primary login-submit" disabled={loading}>
            {loading ? "Validando…" : "Ingresar al sistema"}
          </button>
          <aside className="login-demo-accounts">
            <strong>Accesos de demostración</strong>
            <span>Administrador: admin</span>
            <span>Técnico: tecnico</span>
          </aside>
        </form>
      </section>
    </main>
  );
}
