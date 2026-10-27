import {usePendingChanges} from "./UnsavedChanges";
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import type {OrgUnit} from './needTypes';
import {CollapsibleTable} from './CollapsibleTable';
import {SectionEditor} from './SectionEditor';
type Values=Pick<OrgUnit,'group_name'|'area_name'|'department_name'|'active'>;
export function OrganizationManager({reload,onPendingChange}:{reload:()=>Promise<void>;onPendingChange:(n:number)=>void}){
 const [rows,setRows]=useState<OrgUnit[]>([]),[drafts,setDrafts]=useState<Record<string,Values>>({}),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const count=Object.keys(drafts).length;
 useEffect(()=>{void load();},[]);
 useEffect(()=>{onPendingChange(count);},[count,onPendingChange]);
 useEffect(()=>()=>onPendingChange(0),[onPendingChange]);
 async function load(){const {data,error}=await supabase!.from('organizational_structure').select('*').order('group_name').order('area_name').order('department_name');if(error)setMessage(error.message);else setRows(data||[]);}
 const value=(row:OrgUnit)=>drafts[row.id]||row;
 const effective=[...rows,...Object.keys(drafts).filter(id=>!rows.some(r=>r.id===id)).map(id=>({id,...drafts[id],created_at:''}))];
 function change(row:OrgUnit,key:keyof Values,v:string|boolean){setDrafts(all=>({...all,[row.id]:{group_name:value(row).group_name,area_name:value(row).area_name,department_name:value(row).department_name,active:value(row).active,[key]:v}}));}
 async function save(){if(busy||!count)return;setBusy(true);setMessage('');try{const changes=Object.entries(drafts).map(([id,v])=>{const old=rows.find(r=>r.id===id);return{...v,id:old?.id||null,original:old?{id:old.id,group_name:old.group_name,area_name:old.area_name,department_name:old.department_name,active:old.active}:null};});const {error}=await supabase!.rpc('save_organization_structure',{p_changes:changes});if(error)throw error;setDrafts({});await load();await reload();setMessage('Estructura actualizada.');}catch(e){setMessage((e as Error).message||'No se pudo guardar la estructura.');}finally{setBusy(false);}}
 usePendingChanges(count>0,save,"Estructura organizacional",()=>setDrafts({}));
 return <section className="panel organization-manager"><div className="panelhead"><h2>Estructura organizacional</h2><div className="actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{const id=crypto.randomUUID();setDrafts(all=>({...all,[id]:{group_name:'COLABORADORES',area_name:'',department_name:'',active:true}}));}}>Nueva relación</button><button type="button" className="primary" disabled={busy||!count} onClick={()=>void save()}>{busy?'Guardando…':'Guardar todos los cambios'}</button></div></div>
 <label>Buscar estructura<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Grupo, área o departamento"/></label>
 {message&&<p className="statusmsg" role="status">{message}</p>}
 <fieldset disabled={busy}><SectionEditor title="estructura organizacional"><CollapsibleTable><table><thead><tr><th>Grupo ocupacional</th><th>Área</th><th>Departamento</th><th>Estado</th></tr></thead><tbody>{effective.filter(r=>Object.values(value(r)).join(' ').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(row=><tr key={row.id}>{(['group_name','area_name','department_name'] as const).map((key,i)=><td key={key}><input aria-label={`${['Grupo','Área','Departamento'][i]} ${row.department_name||'nueva relación'}`} value={value(row)[key]} maxLength={250} required onChange={e=>change(row,key,e.target.value)}/></td>)}<td><select aria-label={`Estado ${row.department_name}`} value={String(value(row).active)} onChange={e=>change(row,'active',e.target.value==='true')}><option value="true">Activo</option><option value="false">Inactivo</option></select></td></tr>)}</tbody></table></CollapsibleTable></SectionEditor></fieldset>
 {count>0&&<div className="actions"><span>{count} cambios pendientes</span><button type="button" className="secondary" disabled={busy} onClick={()=>{if(window.confirm('¿Descartar los cambios de estructura sin guardar?'))setDrafts({});}}>Descartar</button></div>}
 </section>;
}
