import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const compiled = await build({ entryPoints: [new URL('../src/competencyMatrix.tsx', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'exceljs'], plugins: [{ name: 'fake-database', setup(builder) {
  builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = globalThis.__database;', loader: 'js' }));
} }] });
const row = i => ({ id: `row-${i}`, area: 'Administración', department: 'Talento Humano', group_name: 'COLABORADORES', factor: 'Blandas', competency: `Competencia ${i}`, description: '', active: true });
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function harness(rows, outcomes = []) {
  const state = [], writes = []; let index = 0, tree, reloads = 0;
  const hooks = { useState(value) { const i = index++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; }, useEffect() { index++; }, useRef() { index++; return { current: null }; } };
  const context = { module: { exports: {} }, exports: {}, crypto: { randomUUID: () => 'new-relation' }, window: { confirm: () => true }, __database: { from() { let write; const q = { insert(value) { write = { action: 'insert', value, id: value.id }; return this; }, update(value) { write = { action: 'update', value }; return this; }, delete() { write = { action: 'delete' }; return this; }, eq(key, id) { write.id = id; return this; }, select() { return this; }, single() { return this.maybeSingle(); }, async maybeSingle() { writes.push(write); const outcome = outcomes.shift(); return outcome === 'error' ? { data: null, error: { message: 'Operación rechazada' } } : outcome === 'missing' ? { data: null, error: null } : { data: { id: write.id }, error: null }; } }; return q; } }, require(name) { return name === 'react' ? hooks : require(name); } };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  function render() { index = 0; tree = context.module.exports.CompetencyMatrixManager({ rows, reload: async () => { reloads++; } }); return tree; }
  function button(text, nth = 0) { const matches = nodes(tree).filter(node => node.type === 'button' && node.props.children === text); assert.ok(matches[nth], `button ${text}`); return matches[nth]; }
  render();
  return { render, button, writes, nodes: () => nodes(tree), reloads: () => reloads, state };
}
test('pagination exposes relations beyond the former 250-item limit without truncation', () => {
  const app = harness(Array.from({ length: 265 }, (_, i) => row(i)));
  for (let page = 0; page < 13; page++) { app.button('Siguiente').props.onClick(); app.render(); }
  assert.ok(app.nodes().some(node => node.type === 'b' && node.props.children === 'Competencia 264'));
  assert.equal(app.button('Siguiente').props.disabled, true);
});
test('deletions are staged, reversible and sent only by the general save', async () => {
  const app = harness([row(1)]);
  app.button('Eliminar').props.onClick(); app.render(); assert.equal(app.writes.length, 0);
  app.button('Deshacer eliminación').props.onClick(); app.render(); assert.equal(app.button('Guardar todos los cambios').props.disabled, true);
  app.button('Eliminar').props.onClick(); app.render(); app.button('Guardar todos los cambios').props.onClick(); for (let i = 0; i < 15; i++) await Promise.resolve(); app.render();
  assert.deepEqual(app.writes, [{ action: 'delete', id: 'row-1' }]); assert.equal(app.reloads(), 1);
});
test('partial and permission failures retain only unconfirmed changes for retry', async () => {
  const app = harness([row(1), row(2)], ['ok', 'missing']);
  app.button('Eliminar', 0).props.onClick(); app.render(); app.button('Eliminar', 0).props.onClick(); app.render();
  // Event handlers intentionally launch the async save; allow its microtasks to finish.
  app.button('Guardar todos los cambios').props.onClick();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  app.render(); assert.equal(Object.keys(app.state[4]).length, 1); assert.equal(app.reloads(), 1);
  app.button('Guardar todos los cambios').props.onClick(); for (let i = 0; i < 15; i++) await Promise.resolve(); app.render();
  assert.equal(Object.keys(app.state[4]).length, 0); assert.equal(app.reloads(), 2);
});
test('creating an incomplete relationship performs no write and preserves the draft', async () => {
  const app = harness([]); app.button('+ Nueva relación').props.onClick(); app.render();
  app.button('Guardar todos los cambios').props.onClick(); await Promise.resolve(); app.render();
  assert.equal(app.writes.length, 0); assert.equal(Object.keys(app.state[4]).length, 1);
  assert.ok(app.nodes().some(node => node.props?.role === 'status' && /Complete/.test(node.props.children)));
});
test('a complete new relationship is inserted only once with its own identity', async () => {
  const app = harness([row(1)]); app.button('+ Nueva relación').props.onClick(); app.render();
  for (const [label, value] of [['Área','Administración'],['Departamento','Talento Humano'],['Factor','Técnicas'],['Competencia a desarrollar','Análisis de datos']]) {
    const field = app.nodes().find(node => node.type === 'label' && Array.isArray(node.props.children) && node.props.children[0] === label);
    const input = nodes(field).find(node => node.type === 'input'); input.props.onChange({ target: { value } }); app.render();
  }
  assert.equal(app.writes.length, 0);
  app.button('Guardar todos los cambios').props.onClick(); for (let i = 0; i < 15; i++) await Promise.resolve();
  assert.equal(app.writes.length, 1); assert.equal(app.writes[0].action, 'insert');
  assert.equal(app.writes[0].id, 'new-relation'); assert.equal(app.writes[0].value.competency, 'Análisis de datos');
});
