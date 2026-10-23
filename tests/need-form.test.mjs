import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: [new URL('../src/NeedForm.tsx', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], plugins: [{ name: 'fake-database', setup(builder) {
  builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = globalThis.__database;', loader: 'js' }));
} }] });
const require = createRequire(import.meta.url);
const fields = { id: 'existing', period_id: 'original-period', factor: 'Blandas', competency: 'Liderazgo', gap: 'Errores frecuentes', objective: 'Reducir errores', position: 'Analista', department: 'Administración', area: 'Operaciones', occupational_group: 'Profesional', participants: 2, indicator: 'Errores mensuales', goal: 'Reducir a 2 en diciembre', evidence: 'Reporte de calidad', priority: 'Media', priority_reason: 'Afecta los plazos', hours: null, estimated_cost: null };

test('editing keeps the original period and saves optional planning without an explicit periodId prop', async () => {
  let operation, payload, completed = false;
  const errors = [];
  const query = { eq(key, value) { assert.equal(key, 'id'); assert.equal(value, fields.id); return this; }, select() { return this; }, async maybeSingle() { return { data: { id: fields.id }, error: null }; } };
  const context = { module: { exports: {} }, exports: {}, __database: { from(table) { assert.equal(table, 'training_needs'); return { update(values) { operation = 'update'; payload = values; return query; } }; } }, require(name) { return name === 'react' ? { ...require('react'), useEffect() {}, useState(value) { return [value, next => { if (typeof next === 'string' && next) errors.push(next); }]; } } : require(name); } };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const form = context.module.exports.NeedForm({ catalogs: [], competencyMatrix: [], orgUnits: [], profile: { role: 'user' }, userId: 'owner', initialNeed: fields, onDone() { completed = true; } });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(operation, 'update');
  assert.equal(completed, true);
  assert.deepEqual(errors, []);
  assert.equal(payload.hours, null);
  assert.equal(payload.estimated_cost, null);
  assert.equal(payload.planned_start_date, null);
  assert.equal(payload.planned_end_date, null);
  assert.equal(payload.quarter, null);
  assert.equal(payload.period_id, undefined, 'editing must not reassign the historical period');
});

for (const role of ['admin', 'user']) test(`${role}: group assignment respects the competency relationship without changing profile permissions`, async () => {
  let payload;
  const profile = { role, occupational_group: 'Profesional', area: fields.area, department: fields.department };
  const relation = { area: fields.area, department: fields.department, factor: fields.factor, competency: fields.competency, group_name: 'JEFATURAS', active: true };
  const query = { eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { id: fields.id }, error: null }; } };
  const context = { module: { exports: {} }, exports: {}, __database: { from() { return { update(values) { payload = values; return query; } }; } }, require(name) { return name === 'react' ? { ...require('react'), useEffect() {}, useState(value) { return [value, () => {}]; } } : require(name); } };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const form = context.module.exports.NeedForm({ catalogs: [], competencyMatrix: [relation], orgUnits: [], profile, userId: 'owner', initialNeed: fields, onDone() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(payload.occupational_group, role === 'admin' ? 'JEFATURAS' : 'Profesional');
  assert.equal(profile.occupational_group, 'Profesional');
});


test('indicator and expected goal are optional and appear only inside proposed planning',async()=>{
 let payload;
 const q={eq(){return this},select(){return this},async maybeSingle(){return{data:{id:fields.id},error:null}}};
 const context={module:{exports:{}},exports:{},__database:{from(){return{update(value){payload=value;return q}}}},require(name){return name==='react'?{...require('react'),useEffect(){},useState(value){return[value,()=>{}]}}:require(name)}};
 vm.runInNewContext(compiled.outputFiles[0].text,context);
 const form=context.module.exports.NeedForm({catalogs:[],competencyMatrix:[],orgUnits:[],profile:{role:'user'},userId:'owner',initialNeed:{...fields,indicator:'',goal:''},onDone(){}});
 await form.props.onSubmit({preventDefault(){}}); assert.equal(payload.indicator,''); assert.equal(payload.goal,'');
 const walk=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(walk)];
 const planning=walk(form).find(node=>node.type==='details'&&node.props.className==='need-planning');
 for (const label of ['Indicador','Meta esperada']) {
  const matches=walk(form).filter(node=>node.type==='label'&&Array.isArray(node.props.children)&&node.props.children[0]===label);
  assert.equal(matches.length,1); assert.ok(walk(planning).includes(matches[0]));
  assert.equal(walk(matches[0]).find(node=>node.type==='input').props.required,undefined);
 }
});

function interactiveForm(initialNeed) {
  const states=[], writes=[]; let index=0, completed=0;
  const react={useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}};
  const query={eq(){return this},select(){return this},async single(){return{data:{id:'new'},error:null}},async maybeSingle(){return{data:{id:'existing'},error:null}}};
  const database={from(table){return{insert(value){writes.push({table,operation:'insert',value});return query},update(value){writes.push({table,operation:'update',value});return query}}}};
  const context={module:{exports:{}},exports:{},__database:database,require(name){return name==='react'?{...require('react'),...react}:require(name)}};
  vm.runInNewContext(compiled.outputFiles[0].text,context);
  const props={catalogs:[],competencyMatrix:[{area:fields.area,department:fields.department,factor:fields.factor,competency:'Liderazgo',group_name:'JEFATURAS',active:true},{area:fields.area,department:fields.department,factor:'Técnicas',competency:'Excel',group_name:'Profesional',active:true}],orgUnits:[],profile:{role:'user',area:fields.area,department:fields.department,occupational_group:'Profesional',position:'Analista'},userId:'owner',period:{id:'2027',name:'2027',start_date:'2027-01-01',end_date:'2027-12-31'},initialNeed,onDone(){completed++}};
  const walk=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(walk)];
  function render(){index=0;return context.module.exports.NeedForm(props)}
  function list(){return walk(render())}
  function mode(label){list().find(node=>node.type==='button'&&node.props.children===label).props.onClick()}
  function input(label,value){const parent=list().find(node=>node.type==='label'&&Array.isArray(node.props.children)&&node.props.children[0]===label);walk(parent).find(node=>node.type==='input'||node.type==='textarea').props.onChange({target:{value}})}
  function component(label,value){list().find(node=>node.props?.label===label).props.onChange(value)}
  return{render,list,mode,input,component,writes,props,completed:()=>completed};
}
test('a user can submit a proposed topic as pending in their own organization without writing the matrix',async()=>{
 const h=interactiveForm();h.component('Factor','Blandas');h.mode('Mi tema no aparece');h.input('Tema o competencia propuesta','  Liderazgo para equipos remotos  ');
 h.input('Brecha identificada / Necesidad identificada','Falta coordinación');h.input('¿Qué deberán saber hacer después?','Coordinar entregables');h.input('Medio de verificación','Actas de seguimiento');h.input('Justificación de prioridad','Mejorar plazos');
 await h.render().props.onSubmit({preventDefault(){}});
 assert.equal(h.writes.length,1);const {table,value}=h.writes[0];assert.equal(table,'training_needs');assert.equal(value.competency,'Liderazgo para equipos remotos');assert.equal(value.status,'Pendiente');assert.equal(value.period_id,'2027');assert.equal(value.owner_id,'owner');assert.equal(value.occupational_group,'Profesional');assert.equal(value.area,fields.area);assert.equal(value.department,fields.department);assert.equal(h.completed(),1);
 assert.equal(h.list().some(node=>node.type==='details'&&node.props.className==='need-assignment'),false);
});
test('topic mode switches preserve each draft and changing factor clears both dependent topic choices',()=>{
 const h=interactiveForm();h.component('Factor','Blandas');h.component('Competencia a desarrollar','Liderazgo');h.mode('Mi tema no aparece');h.input('Tema o competencia propuesta','Coordinación remota');h.mode('Seleccionar de la lista');assert.equal(h.list().find(node=>node.props?.label==='Competencia a desarrollar').props.value,'Liderazgo');
 h.mode('Mi tema no aparece');assert.equal(h.list().find(node=>node.type==='input'&&node.props.placeholder?.startsWith('Ej.: análisis')).props.value,'Coordinación remota');h.component('Factor','Técnicas');assert.equal(h.list().find(node=>node.type==='input'&&node.props.placeholder?.startsWith('Ej.: análisis')).props.value,'');
 h.mode('Seleccionar de la lista');const selector=h.list().find(node=>node.props?.label==='Competencia a desarrollar');assert.deepEqual(Array.from(selector.props.values),['Excel']);assert.equal(selector.props.value,'');
});
test('existing topics outside the matrix remain editable and whitespace proposals cannot be submitted',async()=>{
 const h=interactiveForm({...fields,competency:'Tema histórico fuera de matriz'});
 assert.equal(h.list().find(node=>node.type==='input'&&node.props.placeholder?.startsWith('Ej.: análisis')).props.value,'Tema histórico fuera de matriz');
 h.input('Tema o competencia propuesta','   ');await h.render().props.onSubmit({preventDefault(){}});assert.equal(h.writes.length,0);assert.ok(h.list().some(node=>node.props?.role==='alert'));
 h.input('Tema o competencia propuesta','Tema corregido');await h.render().props.onSubmit({preventDefault(){}});assert.equal(h.writes[0].operation,'update');assert.equal(h.writes[0].value.competency,'Tema corregido');assert.equal(h.writes[0].value.period_id,undefined);
});
