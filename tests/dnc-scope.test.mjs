import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const result=await build({entryPoints:[new URL('../src/dncScope.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {hasDnc,dncUnits,nodeHasDnc}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const needs=[{id:'n',occupational_group:'Colaboradores',area:'Operaciones',department:'Fábrica',competency:'Crédito',estimated_cost:null,participants:0}];
test('DNC membership uses the complete organizational path, even for zero or missing estimates',()=>{
 assert.equal(hasDnc(needs,{group:'COLABORADORES',area:'Operaciones',department:'FABRICA'}),true);
 assert.equal(hasDnc(needs,{group:'Consejo',area:'Operaciones',department:'Fábrica'}),false);
 assert.equal(hasDnc(needs,{group:'Colaboradores',area:'Negocios',department:'Fábrica'}),false);
 assert.equal(hasDnc([],{group:'Colaboradores'}),false);
 const units=[{group_name:'Colaboradores',area_name:'Operaciones',department_name:'Fábrica',active:true},{group_name:'Consejo',area_name:'Operaciones',department_name:'Fábrica',active:true},{group_name:'Colaboradores',area_name:'Operaciones',department_name:'Otro',active:true}];
 assert.deepEqual(dncUnits(units,needs),[units[0]]);
});
test('all budget levels hide branches without DNC without mutating saved allocations',()=>{
 const nodes=[{id:'g',kind:'group',group:'Colaboradores'},{id:'a',kind:'area',group:'Colaboradores',area:'Operaciones'},{id:'d',kind:'department',group:'Colaboradores',area:'Operaciones',department:'Fábrica'},{id:'t',kind:'activity',group:'Colaboradores',area:'Operaciones',department:'Fábrica',name:'Crédito',need_id:'n'},{id:'other',kind:'department',group:'Colaboradores',area:'Operaciones',department:'Otro',value:900}];
 const original=JSON.stringify(nodes);
 assert.deepEqual(nodes.filter(n=>nodeHasDnc(n,needs)).map(n=>n.id),['g','a','d','t']);
 assert.equal(JSON.stringify(nodes),original);
 assert.equal(nodes.filter(n=>nodeHasDnc(n,[])).length,0);
});
