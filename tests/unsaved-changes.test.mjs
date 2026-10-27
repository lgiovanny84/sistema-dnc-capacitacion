import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),compiled=await build({entryPoints:[new URL('../src/UnsavedChanges.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const walk=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(walk)];
function harness(){const state=[],listeners=new Map(),cleanups=[];let index=0,tree;
 const react={...require('react'),useState(initial){const i=index++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef:()=>({current:null}),useEffect(fn){const c=fn();if(c)cleanups.push(c)}};
 const ctx={module:{exports:{}},exports:{},requestAnimationFrame:fn=>fn(),window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name)=>listeners.delete(name)},document:{activeElement:null,body:{style:{overflow:''}}},require:name=>name==='react'?react:require(name)};vm.runInNewContext(compiled.outputFiles[0].text,ctx);
 const api=ctx.module.exports;
 const render=()=>{index=0;tree=api.UnsavedChangesProvider({children:'Pantalla actual'});return tree};render();
 return{api,render,register(save,discard){api.usePendingChanges(true,save,'Prueba',discard);return cleanups.at(-1)},button(label){const b=walk(tree).find(n=>n.type==='button'&&n.props.children===label);assert.ok(b,label);return b},nodes:()=>walk(tree),listeners,async settle(){for(let i=0;i<25;i++)await Promise.resolve();render();}};
}
test('leaving a dirty screen offers save, discard and stay; a failed save cannot navigate or discard drafts',async()=>{
 const app=harness();let navigated=0,saves=0,succeed=false,unregister;
 unregister=app.register(async()=>{saves++;if(succeed)unregister();});
 app.api.requestLeave(()=>navigated++);app.render();assert.ok(app.nodes().some(n=>n.type==='dialog'));app.button('Seguir editando').props.onClick();app.render();assert.equal(navigated,0);
 app.api.requestLeave(()=>navigated++);app.render();app.button('Guardar y continuar').props.onClick();await app.settle();assert.equal(saves,1);assert.equal(navigated,0);assert.ok(app.nodes().some(n=>n.props?.role==='alert'));
 succeed=true;app.button('Guardar y continuar').props.onClick();await app.settle();assert.equal(saves,2);assert.equal(navigated,1);assert.ok(!app.nodes().some(n=>n.type==='dialog'));
});
test('discard is explicit and browser reload/close is warned only while data is dirty',()=>{
 const app=harness();let discarded=0,navigated=0,warned=0;app.register(()=>{},()=>discarded++);
 app.listeners.get('beforeunload')({preventDefault(){warned++}});assert.equal(warned,1);
 app.api.requestLeave(()=>navigated++);app.render();app.button('Salir sin guardar').props.onClick();app.render();assert.equal(discarded,1);assert.equal(navigated,1);
 app.listeners.get('beforeunload')({preventDefault(){warned++}});assert.equal(warned,1);app.api.requestLeave(()=>navigated++);assert.equal(navigated,2);
});
test('sequential save waits for all registered sections and aborts on validation failure or exceptions',async()=>{
 const app=harness(),pending=new app.api.PendingChanges();let first=0,second=0;
 const release=pending.register({label:'A',save:async()=>{first++;release()}});pending.register({label:'B',save:()=>{second++;return false}});
 assert.equal(await pending.saveAll(),false);assert.equal(first,1);assert.equal(second,1);assert.equal(pending.entries.size,1);
 const other=new app.api.PendingChanges();other.register({label:'Error',save(){throw Error('conexión')}});await assert.rejects(other.saveAll(),/conexión/);assert.equal(other.entries.size,1);
});
test('sensitive creation results can keep the screen open to copy first-login credentials',async()=>{
 const app=harness();let navigated=0;const release=app.register(async()=>{release();return{stay:true,message:'Copie las credenciales antes de salir.'}});
 app.api.requestLeave(()=>navigated++);app.render();app.button('Guardar y continuar').props.onClick();await app.settle();assert.equal(navigated,0);assert.ok(app.nodes().some(n=>n.props?.role==='alert'&&n.props.children==='Copie las credenciales antes de salir.'));
});
