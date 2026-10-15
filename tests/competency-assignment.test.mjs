import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import vm from 'node:vm';
const compiled = await build({ entryPoints: [new URL('../src/competencyAssignment.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs' });
const context = { module: { exports: {} }, exports: {} };
vm.runInNewContext(compiled.outputFiles[0].text, context);
const { competencyGroup, needWithCompetencyGroup, validateMatrix, matrixKey } = context.module.exports;
const relation = { id: 'matrix-1', area: 'Administración', department: 'Talento Humano', factor: 'Competencias blandas', competency: 'Liderazgo', group_name: 'JEFATURAS', active: true, description: '' };
const need = { ...relation, occupational_group: 'COLABORADORES', period_id: '2027' };

test('group resolves only from the full selected relationship, ignoring accents/case/outer whitespace', () => {
  assert.equal(competencyGroup([relation], { ...need, area: ' ADMINISTRACION ', department: 'talento humano' }), 'JEFATURAS');
  for (const field of ['area', 'department', 'factor', 'competency']) {
    assert.equal(competencyGroup([relation], { ...need, [field]: 'Otra selección' }), null, field);
    assert.equal(competencyGroup([relation], { ...need, [field]: '' }), null, field);
  }
});
test('inactive and ambiguous relationships retain the recorded group and never mutate history', () => {
  assert.equal(competencyGroup([{ ...relation, active: false }], need), null);
  assert.equal(competencyGroup([relation, { ...relation, id: 'other', group_name: 'DIRECTIVOS' }], need), null);
  assert.equal(needWithCompetencyGroup(need, [{ ...relation, active: false }]), need);
  const resolved = needWithCompetencyGroup(need, [relation]);
  assert.equal(resolved.occupational_group, 'JEFATURAS');
  assert.equal(need.occupational_group, 'COLABORADORES');
  assert.equal(resolved.period_id, '2027');
});
test('creation validates required fields and rejects duplicate relations instead of replacing another group', () => {
  assert.equal(validateMatrix([relation]), null);
  assert.match(validateMatrix([{ ...relation, group_name: '  ' }]), /Complete/);
  assert.match(validateMatrix([relation, { ...relation, competency: 'liderazgo ', group_name: 'DIRECTIVOS' }]), /Ya existe/);
  assert.notEqual(matrixKey({ department: 'A|B', factor: 'C', competency: 'D' }), matrixKey({ department: 'A', factor: 'B|C', competency: 'D' }));
});
