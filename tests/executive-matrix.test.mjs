import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const compiled = await build({entryPoints:[new URL('../src/ExecutiveMatrix.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','exceljs'],plugins:[{name:'no-db',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase=null;',loader:'js'}));}}]});
const context={module:{exports:{}},exports:{},require:createRequire(import.meta.url)};
vm.runInNewContext(compiled.outputFiles[0].text,context);
const {ExecutiveMatrix,executiveVisibleNeeds}=context.module.exports;
const base={id:'n',owner_id:'other',period_id:'2027',competency:'Liderazgo',occupational_group:'G',area:'Administración',department:'Talento Humano',participants:3,estimated_cost:800,hours:2};
const needs=[base,{...base,id:'2',competency:'Compras',department:'Compras'},{...base,id:'3',competency:'Crédito',area:'Negocios',department:'Crédito'}];
const visibility={area:'Administración',department:'Talento Humano',can_view_entire_area:false};
const render=(extra={})=>renderToStaticMarkup(React.createElement(ExecutiveMatrix,{needs,role:'user',visibility,records:[],mappings:[],units:[],periodName:'2027',...extra}));
test('executive matrix follows department and whole-area permissions, and fails closed without a profile',()=>{
 assert.deepEqual(Array.from(executiveVisibleNeeds(needs,'user',visibility),n=>n.id),['n']);
 assert.deepEqual(Array.from(executiveVisibleNeeds(needs,'user',{...visibility,can_view_entire_area:true}),n=>n.id),['n','2']);
 assert.equal(executiveVisibleNeeds(needs,'user',null).length,0);
 assert.equal(executiveVisibleNeeds(needs,'admin').length,3);
});
test('user matrix includes authorized requests from colleagues, without financial columns or filtering/collapse controls',()=>{
 const html=render();assert.match(html,/Matriz consolidada/);assert.match(html,/Liderazgo/);assert.match(html,/800,00/);assert.doesNotMatch(html,/Compras|Crédito|<select|Presupuesto asignado|Utilizado vinculado|Contraer tabla/);
 const area=render({visibility:{...visibility,can_view_entire_area:true}});assert.match(area,/Compras/);assert.doesNotMatch(area,/Crédito/);
});
test('matrix consolidates repeated topics without multiplying participation estimates and keeps unknown costs distinct from zero',()=>{
 const html=render({needs:[base,{...base,id:'duplicate',participants:2,estimated_cost:null}]});assert.match(html,/1 temas · 2 necesidades/);assert.match(html,/>5<\/td>/);assert.match(html,/Por definir/);
 const zero=render({needs:[{...base,estimated_cost:0}]});assert.match(zero,/\$0,00/);
});
test('administrator matrix keeps missing financial plans explicit and exposes no management actions',()=>{
 const html=render({role:'admin'});assert.match(html,/Presupuesto asignado/);assert.match(html,/Utilizado vinculado/);assert.match(html,/Por definir/);assert.match(html,/Crédito/);assert.doesNotMatch(html,/Eliminar|Guardar|Modificar/);
});
