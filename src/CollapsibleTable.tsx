import { ReactNode, useId, useState } from "react";

export function CollapsibleTable({
  children,
  className = "",
  defaultCollapsed = false,
}: {
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = useId();

  return (
    <section className={`collapsible-table${collapsed ? " is-collapsed" : ""}`}>
      <div className="table-collapse-bar">
        <button
          type="button"
          className="table-collapse-button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setCollapsed((current) => !current)}
        >
          <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
          {collapsed ? "Mostrar tabla" : "Contraer tabla"}
        </button>
      </div>
      <div id={contentId} className={`table ${className}`.trim()} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
