import { ArrowRight, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { NavItem } from "@/components/navigation/navData";

interface QuickActionsDialogProps {
  actions: NavItem[];
}

/**
 * QuickActionsDialog
 * Sheet de acciones rápidas globales.
 * Se controla con un ref interno — el padre obtiene el handle mediante
 * la función `open()` devuelta desde el custom hook `useQuickActions`.
 * Uso: const { dialogRef, open } = useQuickActionsDialog();
 *      <button onClick={open} />
 *      <QuickActionsDialog actions={...} dialogRef={dialogRef} />
 */

interface QuickActionsDialogFullProps extends QuickActionsDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
}

export function QuickActionsDialog({ actions, dialogRef, onClose }: QuickActionsDialogFullProps) {
  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-actions-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section className="quick-actions-sheet" aria-labelledby="quick-actions-title">
        <header>
          <div>
            <span>Centro de acciones</span>
            <h2 id="quick-actions-title">¿Qué deseas iniciar?</h2>
          </div>
          <button type="button" aria-label="Cerrar acciones rápidas" onClick={closeDialog}>
            <X />
          </button>
        </header>

        <nav aria-label="Acciones globales">
          {actions.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={closeDialog}>
              <Icon size={23} weight="bold" />
              <span>{label}</span>
              <ArrowRight size={18} weight="bold" />
            </NavLink>
          ))}
        </nav>
      </section>
    </dialog>
  );
}

/** Hook para manejar el estado del dialog de acciones rápidas */
export function useQuickActionsDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function open() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function handleClose() {
    setIsOpen(false);
  }

  return { dialogRef, isOpen, open, handleClose };
}
