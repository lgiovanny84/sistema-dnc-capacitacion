import {useEffect,useRef,useState,type ReactNode} from 'react';
export type PendingEdit={label:string;save:()=>Promise<unknown>|unknown;discard?:()=>void};
export class PendingChanges {
 entries=new Map<symbol,PendingEdit>();
 register(edit:PendingEdit){const id=Symbol();this.entries.set(id,edit);return()=>{this.entries.delete(id);};}
 async saveAll(){for(const edit of [...this.entries.values()]){const result=await edit.save();if(result===false||(result&&typeof result==='object'&&'stay' in result))return result;}return true;}
 discardAll(){for(const edit of [...this.entries.values()])edit.discard?.();this.entries.clear();}
}
const pending=new PendingChanges();
let leaveHandler:((action:()=>void)=>void)|null=null;
export function requestLeave(action:()=>void){if(leaveHandler)leaveHandler(action);else action();}
export function usePendingChanges(dirty:boolean,save:()=>Promise<unknown>|unknown,label:string,discard?:()=>void){
 useEffect(()=>{if(dirty)return pending.register({save,label,discard});},[dirty,save,label,discard]);
}
export function UnsavedChangesProvider({children}:{children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [transition,setTransition]=useState<{action:()=>void}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{leaveHandler=action=>{if(!pending.entries.size){action();return;}setError('');setTransition({action});};const warn=(event:BeforeUnloadEvent)=>{if(pending.entries.size){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>{leaveHandler=null;window.removeEventListener('beforeunload',warn);};},[]);
 useEffect(()=>{if(!transition)return;const element=dialog.current,previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';element?.showModal();element?.querySelector<HTMLElement>('button')?.focus();return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};},[!!transition]);
 async function saveAndLeave(){if(busy||!transition)return;setBusy(true);setError('');try{
  const saved=await pending.saveAll();
  // Let registered forms publish the confirmed result of their existing save handlers.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  if(saved&&typeof saved==='object'&&'message' in saved){setError(String(saved.message));return;}
  if(!saved||pending.entries.size){setError('No se guardaron todos los cambios. Revise los campos o el mensaje de la sección e inténtelo nuevamente.');return;}
  const action=transition.action;setTransition(null);action();
 }catch{setError('No se pudo guardar. Sus cambios siguen en esta pantalla.');}finally{setBusy(false);}}
 return <>{children}{transition&&<dialog ref={dialog} className="edit-modal" aria-modal="true" aria-labelledby="unsaved-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)setTransition(null);}}><div className="edit-modal-body"><h2 id="unsaved-title">Cambios sin guardar</h2><p>¿Desea guardar los cambios antes de salir de esta pantalla?</p><ul>{[...new Set([...pending.entries.values()].map(e=>e.label))].map(label=><li key={label}>{label}</li>)}</ul>{error&&<p role="alert" className="error">{error}</p>}<div className="actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setTransition(null)}>Seguir editando</button><button type="button" className="secondary danger" disabled={busy} onClick={()=>{pending.discardAll();const action=transition.action;setTransition(null);action();}}>Salir sin guardar</button><button type="button" className="primary" disabled={busy} onClick={()=>void saveAndLeave()}>{busy?'Guardando…':'Guardar y continuar'}</button></div></div></dialog>}</>;
}
