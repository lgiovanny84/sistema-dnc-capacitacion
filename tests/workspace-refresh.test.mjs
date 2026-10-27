import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const compiled = await build({ stdin: {contents: readFileSync(new URL('../src/App.tsx', import.meta.url),'utf8')+'\nexport {List};',resolveDir:new URL('../src',import.meta.url).pathname,loader:'tsx'}, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime', 'exceljs'], plugins: [{ name: 'fake-database', setup(builder) {
  builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const configured = true; export const supabase = globalThis.__database;', loader: 'js' }));
} }] });
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function appHarness(role = 'admin') {
  const state = [], effects = [], deps = [], refs = [];
  let index = 0, tree, changed = false, listener, calls = 0, fail = false;
  const session = { user: { id: 'admin', email: 'test@example.invalid' } };
  const tables = {
    profiles: { id: 'admin', email: 'test@example.invalid', role, active: true, deleted_at: null, onboarding_completed_at: '2026-01-01', department: 'Talento Humano', area: 'Administración' },
    planning_periods: [{ id: '2027', name: '2027', active: true, start_date: '2027-01-01', end_date: '2027-12-31' }],
    training_needs: [{ id: 'need', period_id: '2027', area: 'Administración', department: 'Talento Humano', factor: 'Blandas', competency: 'Liderazgo', occupational_group: 'COLABORADORES', hours: null, estimated_cost: null }],
    competency_matrix: [{ id: 'matrix', active: true, area: 'Administración', department: 'Talento Humano', factor: 'Blandas', competency: 'Liderazgo', group_name: 'JEFATURAS' }],
  };
  const react = {
    useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { const value = typeof next === 'function' ? next(state[i]) : next; if (!Object.is(value, state[i])) changed = true; state[i] = value; }]; },
    useRef(initial) { const i = index++; return refs[i] ??= { current: initial }; },
    useEffect(effect, dependencies) { const i = index++; if (!deps[i] || !dependencies || dependencies.some((value, n) => !Object.is(value, deps[i][n]))) { effects.push(effect); deps[i] = dependencies; } },
  };
  const database = {
    auth: { getSession: async () => ({ data: { session } }), onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
    from(table) { calls++; const query = { select() { return this; }, order() { return this; }, eq() { return this; }, single() { return this; }, range() { return this; }, then(resolve) { resolve(fail ? { data: null, error: { message: 'Conexión interrumpida' } } : { data: tables[table] ?? [], error: null }); } }; return query; },
  };
  const context = { module: { exports: {} }, exports: {}, __database: database, localStorage: { getItem: () => null, setItem() {} }, window: { addEventListener() {}, removeEventListener() {}, confirm: () => true }, require(name) { return name === 'react' ? { ...require('react'), ...react } : require(name); }, console };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  function render() { index = 0; changed = false; tree = context.module.exports.default(); return tree; }
  async function flush() { for (let i = 0; i < 25; i++) { for (const effect of effects.splice(0)) effect(); await Promise.resolve(); if (changed) render(); } return tree; }
  render();
  return { render, flush, find(name) { return nodes(tree).find(node => node.type?.name === name); }, adminButton() { return nodes(tree).find(node => node.type === 'button' && nodes(node).some(child => child.type === 'span' && child.props.children === 'Administración')); }, refreshToken() { listener('TOKEN_REFRESHED', { ...session, access_token: 'synthetic-refresh' }); }, calls: () => calls, fail() { fail = true; } };
}
test('saving refreshes data without unmounting administration or resetting the selected period', async () => {
  const app = appHarness(); await app.flush();
  app.adminButton().props.onClick(); app.render(); await app.flush();
  let admin = app.find('Admin'); assert.ok(admin);
  const refresh = admin.props.reload();
  app.render(); assert.ok(app.find('Admin'), 'workspace must remain mounted while loading data');
  await refresh; app.render(); await app.flush();
  admin = app.find('Admin'); assert.ok(admin); assert.equal(admin.props.period.id, '2027');
  assert.equal(admin.props.needs[0].occupational_group, 'JEFATURAS', 'cards and CSV receive the same resolved relationship');
});
test('token renewal preserves the open page and does not reload application data', async () => {
  const app = appHarness(); await app.flush(); app.adminButton().props.onClick(); app.render(); await app.flush();
  const calls = app.calls(); app.refreshToken(); app.render(); await app.flush();
  assert.ok(app.find('Admin')); assert.equal(app.calls(), calls);
});
test('failed refresh retains data and administrator permissions instead of closing the section', async () => {
  const app = appHarness(); await app.flush(); app.adminButton().props.onClick(); app.render(); await app.flush();
  const reload = app.find('Admin').props.reload; app.fail(); await reload(); app.render(); await app.flush();
  assert.ok(app.find('Admin')); assert.equal(app.find('Admin').props.needs.length, 1); assert.equal(app.find('Admin').props.period.id, '2027');
});
test('ordinary users do not receive the administration menu or management component', async () => {
  const app = appHarness('user'); await app.flush(); assert.equal(app.adminButton(), undefined); assert.equal(app.find('Admin'), undefined);
  assert.equal(app.find('Dashboard').props.adminOverview, null);
});


test('editing opens a guarded modal while the existing list remains mounted, and users retain read-only access',()=>{
 const state=[];let index=0,confirmations=0;const context={module:{exports:{}},exports:{},__database:{},window:{confirm(){confirmations++;return false}},require(name){return name==='react'?{...require('react'),useState(initial){const i=index++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value}]}}:require(name)}};
 vm.runInNewContext(compiled.outputFiles[0].text,context);
 const props={needs:[{id:'need',competency:'Liderazgo',status:'Aprobada'}],role:'admin',reload:async()=>{},catalogs:[],competencyMatrix:[],orgUnits:[],profile:{role:'admin'},userId:'admin'};
 function render(){index=0;return context.module.exports.List(props)}
 let tree=render();let table=nodes(tree).find(node=>node.type?.name==='MiniTable');table.props.onEdit(props.needs[0]);tree=render();
 assert.ok(nodes(tree).find(node=>node.type?.name==='MiniTable'),'list stays mounted behind editor');
 let modal=nodes(tree).find(node=>node.type?.name==='Modal');assert.ok(modal);
 const form=nodes(tree).find(node=>node.type?.name==='NeedForm');form.props.onDirtyChange(true);tree=render();modal=nodes(tree).find(node=>node.type?.name==='Modal');form.props.onSavingChange(true);tree=render();modal=nodes(tree).find(node=>node.type?.name==='Modal');modal.props.onClose();assert.equal(confirmations,0);assert.ok(nodes(render()).find(node=>node.type?.name==='Modal'),'busy editor cannot close');
 props.role='user';tree=render();assert.equal(nodes(tree).find(node=>node.type?.name==='MiniTable').props.onEdit,undefined);assert.equal(nodes(tree).find(node=>node.type?.name==='Modal'),undefined);
});


test('administrator overview uses the selected period and carries the same authorized need list',async()=>{
 const app=appHarness();await app.flush();const dashboard=app.find('Dashboard');
 assert.equal(dashboard.props.adminOverview.type.name,'AdminOverview');
 assert.equal(dashboard.props.adminOverview.props.period.id,'2027');
 assert.equal(dashboard.props.adminOverview.props.needs.length,1);
 assert.equal(dashboard.props.adminOverview.props.needs[0].occupational_group,'JEFATURAS');
});


test('user reports freeze the period selector while other user screens retain period selection',async()=>{
 const app=appHarness('user');let tree=await app.flush();let select=nodes(tree).find(n=>n.type==='select'&&n.props.value==='2027');assert.equal(select.props.disabled,false);
 const reports=nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Reportes');reports.props.onClick();app.render();tree=await app.flush();select=nodes(tree).find(n=>n.type==='select'&&n.props.value==='2027');assert.equal(select.props.disabled,true);assert.equal(app.find('ReportCenter').props.role,'user');
});
