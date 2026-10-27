// Presentation preferences only: no rows, names, filters, credentials or financial data.
export type TablePreference={open:boolean;generation:number};
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return(h>>>0).toString(36);}
let lastGeneration=0;
export function nextTableGeneration(minimum=0){lastGeneration=Math.max(Date.now(),lastGeneration+1,minimum+1);return lastGeneration;}
const key=(scope:string,id:string)=>`sgi-table-v1:${hash(scope)}:${hash(id)}`;
export function readTablePreference(scope:string,id:string):TablePreference|null{
 try{if(typeof localStorage==='undefined')return null;const value=JSON.parse(localStorage.getItem(key(scope,id))||'null');if(value&&typeof value.open==='boolean'&&Number.isSafeInteger(value.generation)&&value.generation>=0){lastGeneration=Math.max(lastGeneration,value.generation);return value;}return null;}catch{return null;}
}
export function saveTablePreference(scope:string,id:string,value:TablePreference){try{if(typeof localStorage!=='undefined')localStorage.setItem(key(scope,id),JSON.stringify(value));}catch{/* Private browsing or exhausted storage must not block the interface. */}}
export function resolvedTablePreference(local:TablePreference|null,global:TablePreference|null,fallback:boolean){return local&&(!global||local.generation>=global.generation)?local.open:global?global.open:fallback;}
