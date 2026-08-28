import { DotsThree, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { mobilePrimary, type ModuleGroup } from "@/components/navigation/navData";
import type { SystemUser } from "@/modules/accounts/types";
import { itemsForRole } from "@/components/navigation/navData";

interface MobileNavProps {
  roleModules: ModuleGroup[];
  user: SystemUser | null | undefined;
}

/**
 * MobileNav
 * Barra de navegación inferior para pantallas móviles.
 * Incluye links primarios y un botón "Más" que abre un dialog con todos los módulos.
 */
export function MobileNav({ roleModules, user }: MobileNavProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openMenu() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function closeMenu() {
    dialogRef.current?.close();
  }

  return (
    <>
      {/* ── Bottom navigation bar ─────────────────────────────────────── */}
      <nav className="mobile-navigation" aria-label="Accesos rápidos">
        {mobilePrimary.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}
          >
            <Icon size={21} weight="duotone" />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          className={`mobile-nav-item ${isOpen ? "is-active" : ""}`}
          type="button"
          aria-expanded={isOpen}
          onClick={openMenu}
        >
          <DotsThree size={22} weight="bold" />
          <span>Más</span>
        </button>
      </nav>

      {/* ── More menu dialog ──────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        className="mobile-more-dialog"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <section className="mobile-more-menu" aria-labelledby="mobile-more-title">
          <header>
            <div>
              <strong id="mobile-more-title">Más funciones</strong>
              <span>Accesos secundarios del sistema</span>
            </div>
            <button type="button" aria-label="Cerrar menú" onClick={closeMenu}>
              <X />
            </button>
          </header>

          <div className="mobile-more-groups">
            {roleModules.map((mod) => (
              <div key={mod.id} className="mobile-more-group">
                <h3>{mod.label}</h3>
                <div className="mobile-more-items">
                  {itemsForRole(mod.items, user).map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={closeMenu}
                      className={({ isActive }) => `mobile-more-link ${isActive ? "is-active" : ""}`}
                    >
                      <Icon size={21} weight="duotone" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </dialog>
    </>
  );
}
