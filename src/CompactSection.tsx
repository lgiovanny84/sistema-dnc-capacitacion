import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
// One presentation policy, independent of business settings and permissions.
export const compactLayout = { defaultCollapsed: true, sections: {} as Record<string, { collapsed?: boolean; title?: string; order?: number }> };
const CompactContext = createContext({ generation: 0, expanded: false });
export function useCompactState(defaultCollapsed=compactLayout.defaultCollapsed) {
  const control=useContext(CompactContext);
  const [local,setLocal]=useState({generation:control.generation,open:!defaultCollapsed});
  const open=control.generation===local.generation?local.open:control.expanded;
  return [open,(value:boolean)=>setLocal({generation:control.generation,open:value})] as const;
}
export function CompactWorkspace({ children }: { children: ReactNode }) {
  const [control,setControl]=useState({generation:0,expanded:false});
  const invalidTarget=useRef<HTMLElement|null>(null);
  return <CompactContext.Provider value={control}><div className="compact-workspace" onInvalidCapture={event=>{event.preventDefault();if(invalidTarget.current)return;invalidTarget.current=event.target as HTMLElement;setControl(c=>({generation:c.generation+1,expanded:true}));requestAnimationFrame(()=>{invalidTarget.current?.focus();invalidTarget.current=null;});}}><div className="compact-controls"><span>Vista por secciones</span><button type="button" className="secondary" onClick={()=>setControl(c=>({generation:c.generation+1,expanded:true}))}>Expandir todo</button><button type="button" className="secondary" onClick={()=>setControl(c=>({generation:c.generation+1,expanded:false}))}>Contraer todo</button></div>{children}</div></CompactContext.Provider>;
}
export function CompactSection({ title, children, sectionId, summary }: { title: string; children: ReactNode; sectionId?: string; summary?: ReactNode }) {
  const id=useId(), control=useContext(CompactContext), policy=compactLayout.sections[sectionId||title];
  const [local,setLocal]=useState({generation:control.generation,open:!(policy?.collapsed??compactLayout.defaultCollapsed)});
  const open=control.generation===local.generation ? local.open : control.expanded;
  return <section className="compact-section" data-section={sectionId||title} style={policy?.order==null?undefined:{order:policy.order}}>
    <button type="button" className="compact-heading" aria-expanded={open} aria-controls={id} onClick={()=>setLocal({generation:control.generation,open:!open})}><span><b>{policy?.title||title}</b>{summary&&<small>{summary}</small>}</span><span>{open?'Contraer':'Expandir'} <span aria-hidden="true">{open?'−':'+'}</span></span></button>
    <div id={id} hidden={!open} onInvalidCapture={()=>setLocal({generation:control.generation,open:true})}>{children}</div>
  </section>;
}
