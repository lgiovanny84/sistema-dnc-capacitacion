import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const compiled=await build({entryPoints:[new URL('../src/FormWindow.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const context={module:{exports:{}},exports:{},require};vm.runInNewContext(compiled.outputFiles[0].text,context);
const {FormWindow}=context.module.exports;
test('creation and management open in a named native modal while a closed launcher does not mount editable content',()=>{
 const child=React.createElement('form',null,React.createElement('input',{required:true,defaultValue:'Draft'}));
 const opened=renderToStaticMarkup(React.createElement(FormWindow,{title:'Gestionar usuarios'},child));
 assert.match(opened,/<dialog/);assert.match(opened,/Gestionar usuarios/);assert.match(opened,/required=""/);
 const closed=renderToStaticMarkup(React.createElement(FormWindow,{title:'Gestionar usuarios',initiallyOpen:false},child));
 assert.doesNotMatch(closed,/<dialog|<input/);assert.match(closed,/Abrir gestionar usuarios/);
});
test('read-only periods render the existing consultation view without an editing dialog; busy windows block closing',()=>{
 const html=renderToStaticMarkup(React.createElement(FormWindow,{title:'Presupuesto',disabled:true},React.createElement('p',null,'Solo consulta')));
 assert.equal(html,'<p>Solo consulta</p>');
 const busy=renderToStaticMarkup(React.createElement(FormWindow,{title:'Usuarios',busy:true},'Guardando'));
 assert.match(busy,/aria-busy="true"/);assert.match(busy,/aria-label="Cerrar ventana de edición" disabled=""/);
});
