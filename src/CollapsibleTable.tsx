import { compactLayout, useCompactState } from "./CompactSection";
import { ReactNode, useId } from "react";

export function CollapsibleTable({
  children,
  className = "",
  defaultCollapsed = compactLayout.defaultCollapsed,
}: {
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen, enabled] = useCompactState(defaultCollapsed);
  const collapsed = !open;
  const contentId = useId();

  return (
    <section className={`collapsible-table${collapsed ? " is-collapsed" : ""}`}>
      {enabled && <div className="table-collapse-bar">
        <button
          type="button"
          className="table-collapse-button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
          {collapsed ? "Mostrar tabla" : "Contraer tabla"}
        </button>
      </div>}
      <div id={contentId} className={`table ${className}`.trim()} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
