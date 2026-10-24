import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const result=await build({stdin:{contents:"export {CompactWorkspace,CompactSection} from './CompactSection';export {CollapsibleTable} from './CollapsibleTable';",resolveDir:new URL('../src',import.meta.url).pathname,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const ctx={module:{exports:{}},exports:{},require:createRequire(import.meta.url)};vm.runInNewContext(result.outputFiles[0].text,ctx);
const {CompactWorkspace,CompactSection,CollapsibleTable}=ctx.module.exports;
function render(enabled){return renderToStaticMarkup(React.createElement(CompactWorkspace,{enabled},React.createElement(CompactSection,{title:'Formulario'},React.createElement('input',{name:'dato'})),React.createElement(CollapsibleTable,null,React.createElement('table',null,React.createElement('tbody',null,React.createElement('tr',null,React.createElement('td',null,'Información')))))));}
test('administrator can collapse tables but the form stays visible',()=>{const html=render(true);assert.match(html,/Mostrar tabla/);assert.match(html,/hidden=""/);assert.match(html,/<input name="dato"/);assert.doesNotMatch(html,/compact-heading/);assert.match(html,/Expandir tablas/);});
test('ordinary users see the complete table with no collapse controls or hidden sections',()=>{const html=render(false);assert.match(html,/<table>/);assert.doesNotMatch(html,/hidden=|Mostrar tabla|Contraer tabla|Expandir tablas|compact-heading/);assert.match(html,/<input name="dato"/);});
test('tables outside an administrator workspace default to visible',()=>{const html=renderToStaticMarkup(React.createElement(CollapsibleTable,null,'Contenido'));assert.doesNotMatch(html,/hidden=|Mostrar tabla|table-collapse-button/);});
