import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])")?.focus();
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="edit-modal" aria-labelledby={titleId} aria-modal="true" aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="edit-modal-head"><div><span className="eyebrow">EDICIÓN</span><h2 id={titleId}>{title}</h2></div><button type="button" className="secondary modal-close" aria-label="Cerrar ventana de edición" disabled={busy} onClick={onClose}>×</button></div>
    <div className="edit-modal-body">{children}</div>
  </dialog>, document.body);
}
