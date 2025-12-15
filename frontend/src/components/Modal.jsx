import { useEffect } from "react";
import { Icons } from "../ui/icons";

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="q-modalOverlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="q-modal">
        <div className="q-modalHeader">
          <div className="q-modalTitle">{title || "Modal"}</div>
          <button
            className="q-iconBtn"
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            title="Close"
          >
            <Icons.Close size={18} />
          </button>
        </div>
        <div className="q-modalBody">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
