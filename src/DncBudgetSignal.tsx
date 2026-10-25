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
 // Routine distribution checks stay silent; only actionable notices occupy space.
 if(!state||(!state.error&&!status?.read_only&&!requiresReview&&!(status?.topic_linked&&status?.estimate_unknown)))return null;
 return <section className={`dnc-budget-signal${requiresReview?' has-difference':''}`} aria-label="Control de presupuesto DNC">
 {state.error?<p role="status">No se pudo verificar el presupuesto. <button type="button" className="secondary" onClick={()=>setRetry(v=>v+1)}>Reintentar consulta</button></p>:status&&<>
 {status.read_only?<p>Período cerrado: solo consulta.</p>:requiresReview?<><p role="status">{status.structure_changed_with_budget?'Revise el presupuesto vinculado antes de cambiar la asignación organizacional.':'El monto solicitado difiere del asignado. Revise Presupuestos.'}</p><label className="budget-review-ack"><input type="checkbox" required checked={ack===key} onChange={e=>setAck(e.target.checked?key:'')}/>Entiendo que esta propuesta requiere revisar la asignación en Presupuestos.</label></>:<p>Complete las estimaciones DNC pendientes para verificar el presupuesto.</p>}
 </>}
 </section>;
}
