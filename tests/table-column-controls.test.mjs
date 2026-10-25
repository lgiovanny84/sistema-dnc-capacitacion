import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),React=require('react');
const bundle=await build({entryPoints:[new URL('../src/CollapsibleTable.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const walk=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(walk)];
function harness(enabled=true){const states=[];let index=0,tree,edited;const hooks={...React,useContext:()=>({enabled,generation:0,expanded:false}),useId:()=>':table:',useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];}};const ctx={module:{exports:{}},exports:{},require:n=>n==='react'?hooks:require(n)};vm.runInNewContext(bundle.outputFiles[0].text,ctx);const h=React.createElement;
 const rows=Array.from({length:265},(_,i)=>h('tr',{key:i},h('td',null,`Tema ${i}`),h('td',null,i),h('td',null,h('button',{onClick:()=>edited=i},'Editar'))));
 const props={defaultCollapsed:false,children:h('table',null,h('thead',null,h('tr',null,h('th',null,'Tema'),h('th',null,'Monto'),h('th',null,'Acción'))),h('tbody',null,rows))};
 function render(){index=0;tree=ctx.module.exports.CollapsibleTable(props);return tree;}render();return{render,find:label=>walk(tree).find(n=>n.props?.['aria-label']===label),button:label=>walk(tree).find(n=>n.type==='button'&&n.props.children===label),body:()=>walk(tree).find(n=>n.type==='tbody'),edited:()=>edited,api:ctx.module.exports};
}
test('header filters search every page, respect accents and preserve the correct edit callback',()=>{const app=harness();app.find('Filtrar Tema').props.onChange({target:{value:'Tema 264'}});app.render();const rows=walk(app.body()).filter(n=>n.type==='tr');assert.equal(rows.length,1);app.button('Editar').props.onClick();assert.equal(app.edited(),264);app.button('Limpiar filtros y orden').props.onClick();app.render();assert.equal(walk(app.body()).filter(n=>n.type==='tr').length,25);});
test('sorting is numeric, applied before pagination and reversible, without adding controls to action columns',()=>{const app=harness();assert.equal(app.find('Filtrar Acción'),undefined);app.find('Ordenar por Monto').props.onClick();app.render();app.find('Ordenar por Monto').props.onClick();app.render();assert.equal(walk(app.body()).find(n=>n.type==='td').props.children,'Tema 264');app.button('Siguiente').props.onClick();app.render();assert.equal(walk(app.body()).find(n=>n.type==='td').props.children,'Tema 239');assert.equal(app.api.compareTableValues('$100,50','$200,00')<0,true);assert.equal(app.api.compareTableValues('100.50','200')<0,true);assert.equal(app.api.compareTableValues('31/01/2027','01/02/2027')<0,true);});
test('consultative user tables expose no sorting or header filter controls',()=>{const app=harness(false);assert.equal(app.find('Filtrar Tema'),undefined);assert.equal(app.find('Ordenar por Monto'),undefined);});
