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
      if (loggedUser.role === "USUARIO") defaultPath = "/mi-perfil";
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
            <p>Ingresa con tu código de usuario o correo electrónico.</p>
          </header>
          {error && <div className="login-error" role="alert">{error}</div>}
          <label className="login-field">
            <span>Código de usuario o correo</span>
            <div>
              <User size={19} />
              <input
                autoComplete="username"
                value={workerCode}
                onChange={(event) => setWorkerCode(event.target.value)}
                placeholder="Ej. 22046 o usuario@incalpaca.com"
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
            <strong>Accesos de demostración</strong>
            <span>Administrador: admin / Montescoli3</span>
            <span>Operario: tecnico / Montescoli3</span>
            <span>Supervisor: supervisor / 12345</span>
            <span>Usuario (Básico): usuario / Montescoli3</span>
          </aside>
        </form>
      </section>
    </main>
  );
}
