import { compactLayout, useCompactState } from './CompactSection';
import { Children, Fragment, cloneElement, isValidElement, useId, useState, type ReactNode, type ReactElement } from 'react';
type CellProps={children?:ReactNode;value?:string|number;colSpan?:number;className?:string;'aria-sort'?:'ascending'|'descending'|'none'};
type Cell=ReactElement<CellProps>;
function elements(children:ReactNode):Cell[]{return Children.toArray(children).flatMap(child=>isValidElement<CellProps>(child)?child.type===Fragment?elements(child.props.children):[child]:[]);}
export function tableText(node:ReactNode):string{
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(tableText).join(' ');
 if(!isValidElement<CellProps>(node))return '';
 if(node.type==='input'||node.type==='textarea')return String(node.props.value??'');
 if(node.type==='select'){const option=elements(node.props.children).find(c=>String(c.props.value??tableText(c.props.children))===String(node.props.value));return option?tableText(option.props.children):String(node.props.value??'');}
 return tableText(node.props.children);
}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
function sortable(value:string):number|string{
 const text=value.trim();
 const date=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);if(date)return `${date[3]}-${date[2].padStart(2,'0')}-${date[1].padStart(2,'0')}${date[4]}`;
 if(/^-?\d+\.\d{1,2}$/.test(text))return Number(text);
 if(/^[\s$€−-]*\d[\d.,\s]*\s*%?$/.test(text)){const n=Number(text.replace(/[$€%\s]/g,'').replace(/−/g,'-').replace(/\./g,'').replace(',','.'));if(Number.isFinite(n))return n;}
 return norm(text);
}
export function compareTableValues(a:string,b:string){const x=sortable(a),y=sortable(b);return typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'es',{numeric:true,sensitivity:'base'});}
export function CollapsibleTable({children,className='',defaultCollapsed=compactLayout.defaultCollapsed,pageSize=25}:{children:ReactNode;className?:string;defaultCollapsed?:boolean;pageSize?:number}){
 const [open,setOpen,enabled]=useCompactState(defaultCollapsed),contentId=useId();
 const [controls,setControls]=useState<{schema:string;filters:Record<number,string>;sort:number|null;direction:1|-1;page:number}>({schema:'',filters:{},sort:null,direction:1,page:1});
 const table=elements(children).find(n=>n.type==='table'),parts=table?elements(table.props.children):[];
 const head=parts.find(n=>n.type==='thead'),body=parts.find(n=>n.type==='tbody'),headerRow=head?elements(head.props.children)[0]:null,headers=headerRow?elements(headerRow.props.children):[];
 const labels=headers.map(h=>tableText(h.props.children)),schema=labels.join('|'),state=controls.schema===schema?controls:{schema,filters:{},sort:null,direction:1 as const,page:1};
 const original=body?elements(body.props.children):[],rows=original.filter(row=>elements(row.props.children).length===headers.length&&!elements(row.props.children).some(c=>(c.props.colSpan||1)>1));
 const filtered=enabled?rows.filter(row=>{const cells=elements(row.props.children);return Object.entries(state.filters).every(([i,value])=>norm(tableText(cells[Number(i)]?.props.children)).includes(norm(value)));}):rows;
 const sorted=enabled&&state.sort!=null?[...filtered].sort((a,b)=>{const ac=elements(a.props.children)[state.sort!],bc=elements(b.props.children)[state.sort!];return state.direction*compareTableValues(tableText(ac?.props.children),tableText(bc?.props.children));}):filtered;
 const pages=Math.max(1,Math.ceil(sorted.length/pageSize)),page=Math.min(state.page,pages),active=Object.values(state.filters).some(Boolean)||state.sort!=null;
 const update=(change:Partial<typeof state>)=>setControls({...state,...change});
 const enhancedHead=enabled&&head&&headerRow?cloneElement(head,{},cloneElement(headerRow,{},headers.map((h,i)=>/acci[oó]n/i.test(labels[i])?h:cloneElement(h,{'aria-sort':state.sort===i?state.direction===1?'ascending':'descending':'none'},<div className="column-control"><button type="button" className="column-sort" aria-label={`Ordenar por ${labels[i]}`} onClick={()=>update({sort:state.sort===i&&state.direction===-1?null:i,direction:state.sort===i?state.direction===1?-1:1:1,page:1})}><span>{h.props.children}</span><span aria-hidden="true">{state.sort===i?state.direction===1?'↑':'↓':'↕'}</span></button><input className="column-filter" type="search" aria-label={`Filtrar ${labels[i]}`} placeholder="Filtrar…" value={state.filters[i]||''} onChange={e=>update({filters:{...state.filters,[i]:e.target.value},page:1})}/></div>)))):head;
 const enhancedBody=body?cloneElement(body,{},rows.length?sorted.length?sorted.slice((page-1)*pageSize,page*pageSize):<tr><td colSpan={Math.max(1,headers.length)}>No hay coincidencias con los filtros de la tabla.</td></tr>:body.props.children):body;
 const rendered=table&&head&&body?cloneElement(table,{},parts.map((part,i)=>cloneElement(part.type==='thead'?enhancedHead!:part.type==='tbody'?enhancedBody!:part,{key:i}))):children;
 return <section className={`collapsible-table${!open?' is-collapsed':''}`}>
 {enabled&&<div className="table-collapse-bar"><button type="button" className="table-collapse-button" aria-expanded={open} aria-controls={contentId} onClick={()=>setOpen(!open)}><span aria-hidden="true">{open?'▾':'▸'}</span>{open?'Contraer tabla':'Mostrar tabla'}</button></div>}
 <div id={contentId} hidden={!open}>
 {enabled&&active&&<div className="table-view-status"><span>{sorted.length} de {rows.length} filas · Vista de tabla</span><button type="button" className="secondary" onClick={()=>update({filters:{},sort:null,page:1})}>Limpiar filtros y orden</button></div>}
 <div className={`table ${className}`.trim()}>{rendered}</div>
 {pages>1&&<div className="table-pagination"><span>{sorted.length} filas · Página {page} de {pages}</span><div className="actions"><button type="button" className="secondary" disabled={page===1} onClick={()=>update({page:page-1})}>Anterior</button><button type="button" className="secondary" disabled={page===pages} onClick={()=>update({page:page+1})}>Siguiente</button></div></div>}
 </div></section>;
}
