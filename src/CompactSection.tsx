import {readTablePreference,saveTablePreference,resolvedTablePreference,nextTableGeneration} from "./tablePreferences";
import {SectionEditor,hasEditableFields} from "./SectionEditor";
import { createContext, useContext, useState, type ReactNode } from 'react';
// Presentation policy: only administrator tables may collapse.
export const compactLayout = { defaultCollapsed: true };
const CompactContext = createContext({ enabled: false, generation: 0, expanded: false, scope: "", editEnabled: true });
export function useCompactState(defaultCollapsed=compactLayout.defaultCollapsed,tableKey='table') {
  const control=useContext(CompactContext),scope=control.scope||'';
  const [local,setLocal]=useState(()=>readTablePreference(scope,tableKey));
  const global=control.generation?{generation:control.generation,open:control.expanded}:null;
  const open=!control.enabled||resolvedTablePreference(local,global,!defaultCollapsed);
  return [open,(value:boolean)=>{const next={generation:nextTableGeneration(Math.max(local?.generation||0,control.generation||0)),open:value};setLocal(next);if(control.enabled)saveTablePreference(scope,tableKey,next);},control.enabled] as const;
}
export function CompactWorkspace({ children, enabled=false, storageScope='', editEnabled=true }: { children: ReactNode; enabled?:boolean;storageScope?:string;editEnabled?:boolean }) {
  const [control,setControl]=useState(()=>{const stored=readTablePreference(storageScope,'all');return{generation:stored?.generation||0,expanded:stored?.open||false};});
  function expand(value:boolean){const next={generation:nextTableGeneration(control.generation),expanded:value};saveTablePreference(storageScope,'all',{generation:next.generation,open:value});setControl(next);}
  return <CompactContext.Provider value={{...control,enabled,scope:storageScope,editEnabled}}>{enabled&&<div className="compact-controls"><span>Tablas del administrador</span><button type="button" className="secondary" onClick={()=>expand(true)}>Expandir tablas</button><button type="button" className="secondary" onClick={()=>expand(false)}>Contraer tablas</button></div>}{children}</CompactContext.Provider>;
}
// Compatibility wrapper: cards, forms and sections always remain visible.
export function CompactSection({ title, children, sectionId, summary, heading=false }: { title: string; children: ReactNode; sectionId?: string; summary?: ReactNode; heading?:boolean }) {
  const control=useContext(CompactContext),admin=control.enabled&&(control.editEnabled!==false);
  const content=admin&&!/filtro/i.test(title)&&hasEditableFields(children)?<SectionEditor title={title}>{children}</SectionEditor>:children;
  return <CompactContext.Provider value={{...control,scope:`${control.scope||''}:${sectionId||title}`}}>{heading?<section data-section={sectionId||title}><div className="panelhead"><div><h2>{title}</h2>{summary&&<p>{summary}</p>}</div></div>{content}</section>:<>{content}</>}</CompactContext.Provider>;
}
