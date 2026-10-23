import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const result=await build({entryPoints:[new URL('../src/AdminOverview.tsx',import.meta.url).pathname,new URL('../src/needReview.ts',import.meta.url).pathname],outdir:'out',bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','exceljs'],plugins:[{name:'fake-db',setup(builder){builder.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase = null;',loader:'js'}))}}]});
const modules=result.outputFiles.map(file=>{const context={module:{exports:{}},exports:{},require};vm.runInNewContext(file.text,context);return context.module.exports});
const {GroupBudgetCards,AdminOverview}=modules.find(value=>value.GroupBudgetCards);
const {budgetByOccupationalGroup,missingNeedFields}=modules.find(value=>value.budgetByOccupationalGroup);
const complete={id:'need',period_id:'2027',occupational_group:'COLABORADORES',department:'Talento Humano',area:'Administración',factor:'Técnicas',competency:'Análisis',gap:'Errores',objective:'Reducir errores',position:'Analista',participants:2,evidence:'Informe',priority:'Media',priority_reason:'Afecta el servicio',indicator:'Errores por mes',goal:'Menos de 2',planned_start_date:'2027-02-01',planned_end_date:'2027-02-02',hours:4,estimated_cost:800,modality:'Presencial'};
test('group budgets sum every activity once, normalize names and reconcile cents without duplicating department allocations',()=>{
 const rows=budgetByOccupationalGroup([complete,{...complete,id:'second',occupational_group:' colaboradores ',estimated_cost:.1},{...complete,id:'third',occupational_group:'CONSEJO',estimated_cost:.2},{...complete,id:'no-group',occupational_group:'',estimated_cost:50}],['COLABORADORES','Consejo','COLABORADORES']);
 assert.equal(rows.length,3);assert.equal(rows.find(row=>row.name==='COLABORADORES').amount,800.1);assert.equal(rows.reduce((s,row)=>s+row.cents,0),85030);
});
test('confirmed singular and plural Assembly names share one budget card and export aggregate without altering source rows',()=>{
 const needs=[{...complete,occupational_group:'Asamblea de representante',estimated_cost:125.35},{...complete,id:'plural',occupational_group:'ASAMBLEA DE REPRESENTANTES',estimated_cost:74.65},{...complete,id:'pending',occupational_group:' Asamblea de representante ',estimated_cost:null}];
 const groups=['Asamblea de representante','Asamblea de representantes','REPRESENTANTE ASAMBLEA'];
 const totals=budgetByOccupationalGroup(needs,groups);
 assert.equal(totals.length,2);
 const assembly=totals.find(row=>row.name==='ASAMBLEA DE REPRESENTANTES');
 assert.equal(assembly.amount,200);assert.equal(assembly.activities,3);assert.equal(assembly.known,2);assert.equal(assembly.pending,1);
 assert.equal(totals.find(row=>row.name==='REPRESENTANTE ASAMBLEA').activities,0);
 assert.equal(needs[0].occupational_group,'Asamblea de representante');
 const html=renderToStaticMarkup(React.createElement(GroupBudgetCards,{needs,groups,periodName:'2027'}));
 assert.equal((html.match(/<h3>ASAMBLEA DE REPRESENTANTES<\/h3>/g)||[]).length,1);
 assert.match(html,/Administración → Competencias/);assert.match(html,/Guardar todos los cambios/);
});
test('unknown budgets, partial totals, genuine zero and configured groups without activities remain distinct',()=>{
 const data=budgetByOccupationalGroup([{...complete,estimated_cost:null},{...complete,id:'zero',occupational_group:'DIRECTIVOS',estimated_cost:0}],['COLABORADORES','DIRECTIVOS','ASAMBLEA']);
 assert.equal(data.find(row=>row.name==='COLABORADORES').known,0);assert.equal(data.find(row=>row.name==='DIRECTIVOS').known,1);assert.equal(data.find(row=>row.name==='ASAMBLEA').activities,0);
 const html=renderToStaticMarkup(React.createElement(GroupBudgetCards,{needs:[complete,{...complete,id:'unknown',estimated_cost:null}],groups:['ASAMBLEA'],periodName:'2027'}));
 assert.match(html,/Monto parcial/);assert.match(html,/1 por presupuestar/);assert.match(html,/Sin asignación registrada/);assert.match(html,/800/);
});
test('completeness identifies specific missing sections without flagging zero costs or legacy planned dates',()=>{
 assert.equal(missingNeedFields(complete).length,0);
 const missing=missingNeedFields({...complete,estimated_cost:0,hours:null,indicator:' ',goal:'',planned_start_date:null,planned_end_date:null,planned_date:'2027-04-01'});
 assert.deepEqual(Array.from(missing,([key])=>key),['indicator','goal','hours']);
 const essential=missingNeedFields({...complete,department:'',participants:0});assert.deepEqual(Array.from(essential,([key])=>key),['department','participants']);
});
test('administrator sees counts, explicit missing fields and a direct completion action',()=>{
 const html=renderToStaticMarkup(React.createElement(AdminOverview,{needs:[{...complete,indicator:'',goal:'',estimated_cost:null}],groups:['COLABORADORES'],catalogs:[],competencyMatrix:[],orgUnits:[],profile:{role:'admin'},userId:'admin',period:{name:'2027'},reload:async()=>{}}));
 assert.match(html,/Actividades con datos pendientes/);assert.match(html,/1 por completar/);assert.match(html,/Indicador/);assert.match(html,/Meta esperada/);assert.match(html,/Completar datos/);assert.match(html,/opcionales durante el levantamiento/);
});


test('administrator can filter pending activities and open planning directly; saved changes update the pending count',async()=>{
 const compiled=result.outputFiles.find(file=>file.path.endsWith('AdminOverview.js')).text;
 const states=[];let index=0,reloads=0;
 const context={module:{exports:{}},exports:{},window:{confirm:()=>true},require(name){if(name==='react')return{...require('react'),useState(initial){const i=index++;if(!(i in states))states[i]=initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}};return require(name)}};
 vm.runInNewContext(compiled,context);
 const props={needs:[{...complete,id:'plan',goal:''},{...complete,id:'essential',gap:''}],groups:[],catalogs:[],competencyMatrix:[],orgUnits:[],profile:{role:'admin'},userId:'admin',period:{name:'2027'},reload:async()=>{reloads++}};
 const walk=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(walk)];
 function render(){index=0;return context.module.exports.AdminOverview(props)}
 let tree=render();const stage=walk(tree).find(node=>node.type==='label'&&Array.isArray(node.props.children)&&node.props.children[0]==='Sección pendiente');
 walk(stage).find(node=>node.type==='select').props.onChange({target:{value:'Planificación'}});tree=render();
 const actions=walk(tree).filter(node=>node.type==='button'&&node.props.children==='Completar datos');assert.equal(actions.length,1);actions[0].props.onClick();tree=render();
 const form=walk(tree).find(node=>node.type?.name==='NeedForm');assert.equal(form.props.initialNeed.id,'plan');assert.equal(form.props.openPlanning,true);
 props.needs=[complete];await form.props.onDone();tree=render();assert.equal(reloads,1);assert.equal(walk(tree).some(node=>node.type?.name==='Modal'),false);
 assert.ok(walk(tree).some(node=>node.type==='span'&&Array.isArray(node.props.children)&&node.props.children[0]===0));
});
