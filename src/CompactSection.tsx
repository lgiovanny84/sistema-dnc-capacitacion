import {SectionEditor,hasEditableFields} from "./SectionEditor";
import { createContext, useContext, useState, type ReactNode } from 'react';
// Presentation policy: only administrator tables may collapse.
export const compactLayout = { defaultCollapsed: true };
const CompactContext = createContext({ enabled: false, generation: 0, expanded: false });
export function useCompactState(defaultCollapsed=compactLayout.defaultCollapsed) {
  const control=useContext(CompactContext);
  const [local,setLocal]=useState({generation:control.generation,open:!defaultCollapsed});
  const open=!control.enabled || (control.generation===local.generation?local.open:control.expanded);
  return [open,(value:boolean)=>setLocal({generation:control.generation,open:value}),control.enabled] as const;
}
export function CompactWorkspace({ children, enabled=false }: { children: ReactNode; enabled?:boolean }) {
  const [control,setControl]=useState({generation:0,expanded:false});
  return <CompactContext.Provider value={{...control,enabled}}>{enabled&&<div className="compact-controls"><span>Tablas del administrador</span><button type="button" className="secondary" onClick={()=>setControl(c=>({generation:c.generation+1,expanded:true}))}>Expandir tablas</button><button type="button" className="secondary" onClick={()=>setControl(c=>({generation:c.generation+1,expanded:false}))}>Contraer tablas</button></div>}{children}</CompactContext.Provider>;
}
// Compatibility wrapper: cards, forms and sections always remain visible.
export function CompactSection({ title, children, sectionId, summary, heading=false }: { title: string; children: ReactNode; sectionId?: string; summary?: ReactNode; heading?:boolean }) {
  const admin=useContext(CompactContext).enabled;
  const content=admin&&!/filtro/i.test(title)&&hasEditableFields(children)?<SectionEditor title={title}>{children}</SectionEditor>:children;
  return heading?<section data-section={sectionId||title}><div className="panelhead"><div><h2>{title}</h2>{summary&&<p>{summary}</p>}</div></div>{content}</section>:<>{content}</>;
}
