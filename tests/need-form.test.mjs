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
  const context = { module: { exports: {} }, exports: {}, __database: { from(table) { assert.equal(table, 'training_needs'); return { update(values) { operation = 'update'; payload = values; return query; } }; } }, require(name) { return name === 'react' ? { useEffect() {}, useState(value) { return [value, next => { if (typeof next === 'string' && next) errors.push(next); }]; } } : require(name); } };
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
  const context = { module: { exports: {} }, exports: {}, __database: { from() { return { update(values) { payload = values; return query; } }; } }, require(name) { return name === 'react' ? { useEffect() {}, useState(value) { return [value, () => {}]; } } : require(name); } };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const form = context.module.exports.NeedForm({ catalogs: [], competencyMatrix: [relation], orgUnits: [], profile, userId: 'owner', initialNeed: fields, onDone() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(payload.occupational_group, role === 'admin' ? 'JEFATURAS' : 'Profesional');
  assert.equal(profile.occupational_group, 'Profesional');
});


test('indicator and expected goal are optional and appear only inside proposed planning',async()=>{
 let payload;
 const q={eq(){return this},select(){return this},async maybeSingle(){return{data:{id:fields.id},error:null}}};
 const context={module:{exports:{}},exports:{},__database:{from(){return{update(value){payload=value;return q}}}},require(name){return name==='react'?{useEffect(){},useState(value){return[value,()=>{}]}}:require(name)}};
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
