import { Children, cloneElement, isValidElement, useId, useRef, useState, type ReactNode, type ReactElement } from 'react';
type FieldProps = {children?:ReactNode;value?:unknown;type?:string;disabled?:boolean;readOnly?:boolean;onChange?:(...args:any[])=>void;onClick?:(e:any)=>void;onMouseDown?:(e:any)=>void;onKeyDown?:(e:any)=>void;'data-edit-navigation'?:boolean;'aria-label'?:string};
const navigation=/^(Buscar|Filtrar|Departamento para logística|Tema para logística|Fondo$)/i;
export function editableFields(children:ReactNode, editing:boolean):ReactNode {
 return Children.map(children,child=>{
  if(!isValidElement<FieldProps>(child))return child;
  const p=child.props,isNative=['input','textarea','select'].includes(String(child.type)),isField=isNative||(p.onChange!=null&&'value' in p);
  if(isField&&p.onChange&&!p.disabled&&!p.readOnly&&p.type!=='file'&&!p['data-edit-navigation']&&!navigation.test(p['aria-label']||'')){
   const locked=!editing,select=child.type==='select',toggle=['checkbox','radio','range','color'].includes(p.type||'');
   return cloneElement(child as ReactElement<FieldProps>,{
    readOnly:locked,
    onChange:(...args:any[])=>{if(!locked)p.onChange?.(...args);},
    ...(select?{onMouseDown:(e:any)=>{if(locked)e.preventDefault();else p.onMouseDown?.(e);},onKeyDown:(e:any)=>{if(locked&&e.key!=='Tab')e.preventDefault();else p.onKeyDown?.(e);}}:{}),
    ...(toggle?{onClick:(e:any)=>{if(locked)e.preventDefault();else p.onClick?.(e);}}:{}),
   });
  }
  return p.children?cloneElement(child,{children:editableFields(p.children,editing)}):child;
 });
}
export function hasEditableFields(children:ReactNode):boolean {
 return Children.toArray(children).some(child=>isValidElement<FieldProps>(child)&&((!!child.props.onChange&&'value' in child.props&&!child.props.disabled&&child.props.type!=='file')||hasEditableFields(child.props.children)));
}
export function SectionEditor({children,title,enabled=true,initialEditing=false}:{children:ReactNode;title:string;enabled?:boolean;initialEditing?:boolean}){
 const [editing,setEditing]=useState(initialEditing),ref=useRef<HTMLDivElement>(null),id=useId();
 function edit(target?:HTMLElement){setEditing(true);requestAnimationFrame(()=>{const field=target?.closest('input,textarea,select') as HTMLElement|null;const local=target?.closest('label,td')?.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');(field||local||ref.current?.querySelector<HTMLElement>('input:not(:disabled):not([readonly]),textarea:not(:disabled):not([readonly]),select:not(:disabled)'))?.focus();});}
 if(!enabled)return <>{children}</>;
 return <div className={`section-editor${editing?' is-editing':''}`} onDoubleClick={event=>{if((event.target as HTMLElement).closest('input,textarea,select,label,td'))edit(event.target as HTMLElement);}}>
  <div className="section-editor-toolbar"><button type="button" className="secondary" aria-controls={id} aria-pressed={editing} aria-label={`Hacer doble clic para editar ${title}`} onClick={()=>edit()}>Hacer doble clic para editar</button>{editing&&<span>Edición habilitada · guarde los cambios de la sección</span>}</div>
  <div id={id} ref={ref}>{editableFields(children,editing)}</div>
 </div>;
}
