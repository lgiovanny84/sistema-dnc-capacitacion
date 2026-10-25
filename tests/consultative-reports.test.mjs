import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const compiled=await build({stdin:{contents:readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')+"\nexport { ReportCenter as Reports } from './ReportCenter'; export { reportNeeds } from './reportFilters';",resolveDir:new URL('../src',import.meta.url).pathname,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','exceljs'],plugins:[{name:'no-db',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase=null;export const configured=false;',loader:'js'}));}}]});
const context={module:{exports:{}},exports:{},require:createRequire(import.meta.url)};vm.runInNewContext(compiled.outputFiles[0].text,context);const{Reports,reportNeeds}=context.module.exports;
const filters={type:'Externa',factor:'Técnicas',area:'Otra área',department:'Otro',occupational_group:'Otro grupo',status:'Ejecutada'};
function html(role){return renderToStaticMarkup(React.createElement(Reports,{role,needs:[],records:[],mappings:[],units:[],filters,setFilters(){throw Error('read-only')},options:()=>[],totalHours:0,budget:0,exportCSV(){},period:{name:'2027'}}));}
test('ordinary report is consultative: no filters or reset, with read-only export retained',()=>{const page=html('user');assert.doesNotMatch(page,/<select|>Limpiar</);assert.match(page,/Temas seleccionados en DNC/);assert.match(page,/Exportar Excel institucional/);assert.match(page,/Consulta del período y alcance autorizado/);});
test('administrators choose the report and organizational filters',()=>{const page=html('admin');assert.equal((page.match(/<select/g)||[]).length,5);assert.match(page,/>Limpiar filtros</);});
test('stale administrator filters never suppress authorized rows for a user',()=>{const needs=[{type:'Interna',department:'Talento Humano'},{type:'Externa',department:'Talento Humano'}];assert.equal(reportNeeds(needs,filters,'user'),needs);assert.equal(reportNeeds(needs,filters,'admin').length,0);});
