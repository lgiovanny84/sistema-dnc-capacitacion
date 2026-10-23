import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const result=await build({entryPoints:[new URL('../src/Modal.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime']});
function setup(busy=false){
 let open=false,focused=false,restored=false,closed=0,cleanup;
 const dialog={showModal(){open=true},close(){open=false},querySelector(){return{focus(){focused=true}}}};
 const doc={body:{style:{overflow:'auto'}},activeElement:{isConnected:true,focus(){restored=true}}};
 const context={module:{exports:{}},exports:{},document:doc,require(name){if(name==='react')return{useId:()=> 'modal-title',useRef:()=>({current:dialog}),useEffect(fn){cleanup=fn()}};if(name==='react-dom')return{createPortal:child=>child};return require(name)}};
 vm.runInNewContext(result.outputFiles[0].text,context);
 const tree=context.module.exports.Modal({title:'Modificar necesidad',children:'Formulario',busy,onClose(){closed++}});
 return{tree,doc,cleanup,state:()=>({open,focused,restored,closed})};
}
test('modal opens with a named dialog, focuses the form, locks scrolling and restores focus when closed',()=>{
 const app=setup(); assert.equal(app.tree.type,'dialog'); assert.equal(app.tree.props['aria-labelledby'],'modal-title');assert.equal(app.tree.props['aria-modal'],'true');
 assert.equal(app.state().open,true);assert.equal(app.state().focused,true);assert.equal(app.doc.body.style.overflow,'hidden');
 app.cleanup();assert.equal(app.state().open,false);assert.equal(app.state().restored,true);assert.equal(app.doc.body.style.overflow,'auto');
});
test('Escape cannot dismiss an edit while saving and otherwise goes through the guarded close callback',()=>{
 for(const busy of [true,false]) {const app=setup(busy);let prevented=false;app.tree.props.onCancel({preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(app.state().closed,busy?0:1)}
});
