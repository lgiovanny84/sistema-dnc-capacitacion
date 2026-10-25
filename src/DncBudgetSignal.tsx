import { useEffect, useState } from 'react';
import { supabase } from './supabase';
export type BudgetSignal={has_plan:boolean;group_distributed:boolean;area_distributed:boolean;structure_changed_with_budget:boolean;department_distributed:boolean;topic_linked:boolean;estimate_unknown:boolean;estimate_differs:boolean;read_only:boolean};
export function DncBudgetSignal({periodId,group,area,department,topic,estimate,needId}:{periodId?:string|null;group:string;area:string;department:string;topic:string;estimate:string;needId?:string}){
 const key=JSON.stringify([periodId,group,area,department,topic,estimate,needId]),ready=!!(periodId&&group&&area&&department);
 const [result,setResult]=useState<{key:string;data:BudgetSignal|null;error:boolean}|null>(null),[retry,setRetry]=useState(0),[ack,setAck]=useState('');
 useEffect(()=>{
  let active=true;setAck('');
  if(!ready)return;
  const timer=setTimeout(()=>{void (async()=>{
   try{
    if(!supabase)throw new Error('No hay conexión');
    const amount=estimate.trim()===''?null:Number(estimate);
    if(amount!=null&&(!Number.isFinite(amount)||amount<0))throw new Error('Estimación no válida');
    const {data,error}=await supabase.rpc('dnc_budget_signals',{p_period:periodId,p_group:group,p_area:area,p_department:department,p_competency:topic.trim(),p_estimated_cost:amount,p_need_id:needId||null});
    if(error||!data||typeof data.has_plan!=='boolean')throw new Error('No se verificó la distribución');
    if(active)setResult({key,data:data as BudgetSignal,error:false});
   }catch{if(active)setResult({key,data:null,error:true});}
  })();},300);
  return()=>{active=false;clearTimeout(timer);};
 },[key,retry]);
 if(!ready)return null;
 const state=result?.key===key?result:null,status=state?.data,requiresReview=!!(status?.estimate_differs||status?.structure_changed_with_budget);
 return <section className={`dnc-budget-signal${requiresReview?' has-difference':''}`} aria-label="Control de presupuesto DNC">
 <h3>Control de presupuesto</h3>
 {!state?<p role="status">Verificando distribución del departamento…</p>:state.error?<p role="status">🔴 No se pudo verificar la distribución. Revise la conexión. Guardar la DNC no modifica las asignaciones presupuestarias. <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Reintentar consulta</button></p>:status&&<>
 <div className="budget-signal-tags"><span className="tag">{status.group_distributed?'Grupo con distribución':'Grupo pendiente de distribución'}</span><span className="tag">{status.area_distributed?'Área con distribución':'Área pendiente de distribución'}</span><span className="tag">{status.department_distributed?'Departamento con presupuesto distribuido':'Departamento sin monto distribuido'}</span><span className="tag">{status.topic_linked?'Tema vinculado a Presupuestos':'Tema sin asignación vinculada'}</span></div>
 {!status.has_plan&&<p>Aún no hay presupuesto guardado para este período.</p>}
 {status.read_only?<p>Período cerrado: solo consulta.</p>:requiresReview?<><p role="status">{status.structure_changed_with_budget?'🔴 Esta DNC tiene presupuesto vinculado a otra estructura. Revise su asignación anterior antes de redistribuirla.':'🔴 La propuesta consolidada DNC difiere de la asignación guardada para este tema. Revise el presupuesto antes de cambiar su distribución.'}</p><label className="budget-review-ack"><input type="checkbox" required checked={ack===key} onChange={e=>setAck(e.target.checked?key:'')}/>Entiendo que esta propuesta requiere revisar la asignación en Presupuestos.</label></>:status.topic_linked&&status.estimate_unknown?<p>Existe una asignación. Complete las estimaciones DNC pendientes para comprobar su correspondencia.</p>:status.topic_linked?<p>La propuesta consolidada coincide con la asignación guardada.</p>:status.department_distributed?<p>La asignación del nuevo tema deberá respetar el presupuesto del departamento.</p>:status.area_distributed||status.group_distributed?<p>Existe distribución en los niveles superiores; falta asignar un monto a este departamento.</p>:null}
 <p className="budget-signal-help">La DNC registra lo solicitado. Los montos asignados se modifican únicamente en Presupuestos, dentro de los límites del grupo ocupacional, área y departamento.</p>
 </>}
 </section>;
}
