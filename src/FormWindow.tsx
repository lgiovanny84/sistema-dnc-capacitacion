import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { requestLeave } from "./UnsavedChanges";

// The existing form owns validation, drafts and persistence. This component only
// changes its presentation; closing uses the application's unsaved-change guard.
export function FormWindow({ title, children, busy = false, initiallyOpen = true, disabled = false }: {
  title: string; children: ReactNode; busy?: boolean; initiallyOpen?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (disabled) return <>{children}</>;
  return <section className="form-window-launcher">
    <div className="panelhead"><h2>{title}</h2><button type="button" className="primary" disabled={busy} onClick={() => setOpen(true)}>Abrir {title.toLocaleLowerCase("es")}</button></div>
    {open && <Modal title={title} busy={busy} onClose={() => requestLeave(() => setOpen(false))}>{children}</Modal>}
  </section>;
}
