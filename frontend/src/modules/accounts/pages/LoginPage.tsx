import { LockKey, ShieldCheck, User } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { BrandLogo } from "@/components/shared/BrandLogo";

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
      const loggedUser = await login({ workerCode: workerCode.trim(), password });
      let defaultPath = "/";
      if (loggedUser.role === "SUPERVISOR") defaultPath = "/supervision";
      if (loggedUser.role === "SOLICITANTE") defaultPath = "/mi-perfil";
      navigate((location.state as { from?: string } | null)?.from ?? defaultPath, {
        replace: true,
      });
    } catch (err: unknown) {
      console.error("Login failed:", err);
      const apiError = (err as { response?: { data?: { detail?: string; non_field_errors?: string[] } } })?.response?.data;
      const detail = apiError?.detail ?? apiError?.non_field_errors?.[0] ?? "No pudimos iniciar sesión. Verifica el código y la contraseña.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <BrandLogo size={52} style={{ marginBottom: 22 }} />
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
            <span>FM Incalpaca</span>
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
          <p className="login-privacy-copy">
            Al ingresar, el sistema registra el acceso para proteger los bienes y la trazabilidad del servicio. Consulta el aviso de privacidad y ejerce tus derechos ARCO en <a href="/privacidad">Privacidad</a>.
          </p>
          <aside className="login-demo-accounts">
            <strong>Ingreso rápido (demostración):</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => {
                  setWorkerCode("admin");
                  setPassword("Montescoli3");
                  void login({ workerCode: "admin", password: "Montescoli3" }).then((u) => navigate(u.role === "SUPERVISOR" ? "/supervision" : "/"));
                }}
              >
                👑 Admin (admin)
              </button>
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => {
                  setWorkerCode("supervisor");
                  setPassword("12345");
                  void login({ workerCode: "supervisor", password: "12345" }).then(() => navigate("/supervision"));
                }}
              >
                📋 Supervisor (supervisor)
              </button>
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => {
                  setWorkerCode("tecnico");
                  setPassword("Montescoli3");
                  void login({ workerCode: "tecnico", password: "Montescoli3" }).then(() => navigate("/mi-jornada"));
                }}
              >
                🛠️ Técnico (tecnico)
              </button>
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => {
                  setWorkerCode("usuario");
                  setPassword("Montescoli3");
                  void login({ workerCode: "usuario", password: "Montescoli3" }).then(() => navigate("/mi-perfil"));
                }}
              >
                👤 Solicitante (usuario)
              </button>
            </div>
          </aside>
        </form>
      </section>
    </main>
  );
}
