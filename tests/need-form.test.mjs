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
  const context = { module: { exports: {} }, exports: {}, __database: { from(table) { assert.equal(table, 'training_needs'); return { update(values) { operation = 'update'; payload = values; return query; } }; } }, require(name) { return name === 'react' ? { useState(value) { return [value, next => { if (typeof next === 'string' && next) errors.push(next); }]; } } : require(name); } };
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
