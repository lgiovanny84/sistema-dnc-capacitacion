import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/needPlanning.ts', import.meta.url), 'utf8');
const context = { exports: {}, Date, Number };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { validatePlanning, planningValues, needReportColumns, needReportValue } = context.exports;
const period = { start_date: '2027-01-01', end_date: '2027-12-31' };
const blank = { planned_start_date: '', planned_end_date: '', hours: '', estimated_cost: '' };

test('a need can be registered before scheduling or estimating resources', () => {
  assert.equal(validatePlanning(blank, period), '');
  const payload = planningValues(blank);
  for (const field of ['planned_date', 'planned_start_date', 'planned_end_date', 'quarter', 'hours', 'estimated_cost']) assert.equal(payload[field], null);
});
test('unknown cost stays distinct from a genuine zero and fractional hours survive', () => {
  assert.equal(planningValues({ ...blank, estimated_cost: '0', hours: '2.5' }).estimated_cost, 0);
  assert.equal(planningValues({ ...blank, estimated_cost: '0', hours: '2.5' }).hours, 2.5);
  assert.equal(planningValues({ ...blank, estimated_cost: '  ' }).estimated_cost, null);
});
test('partial, inverted, invalid calendar dates and dates outside the period are rejected', () => {
  for (const [start, end] of [['2027-05-01', ''], ['', '2027-05-01'], ['2027-05-02', '2027-05-01'], ['2027-02-29', '2027-03-01'], ['2026-12-31', '2027-01-01'], ['2027-12-31', '2028-01-01']]) {
    assert.ok(validatePlanning({ ...blank, planned_start_date: start, planned_end_date: end }, period));
  }
  assert.equal(validatePlanning({ ...blank, planned_start_date: '2027-01-01', planned_end_date: '2027-12-31' }, period), '');
});
test('quarter follows the start date and is cleared when scheduling is removed', () => {
  for (const [date, quarter] of [['2027-03-31', 'Q1'], ['2027-04-01', 'Q2'], ['2027-07-01', 'Q3'], ['2027-10-01', 'Q4']]) {
    assert.equal(planningValues({ ...blank, planned_start_date: date, planned_end_date: date }).quarter, quarter);
  }
  assert.equal(planningValues(blank).quarter, null);
});
test('invalid numeric estimates cannot be persisted as zero or NaN', () => {
  for (const hours of ['0', '-1', 'NaN', 'Infinity', 'abc']) assert.ok(validatePlanning({ ...blank, hours }, period));
  for (const estimated_cost of ['-1', 'NaN', 'Infinity', 'abc']) assert.ok(validatePlanning({ ...blank, estimated_cost }, period));
  assert.equal(validatePlanning({ ...blank, estimated_cost: '0', hours: '0.25' }, period), '');
});
test('Spanish exports retain meaningful missing values and place the goal after the indicator', () => {
  const index = needReportColumns.findIndex(([key]) => key === 'indicator');
  assert.equal(needReportColumns[index][1], 'Indicador');
  assert.equal(needReportColumns[index + 1][1], 'Meta esperada');
  assert.equal(needReportColumns.find(([key]) => key === 'priority_reason')[1], 'Justificación de prioridad');
  assert.equal(needReportValue({ estimated_cost: null }, 'estimated_cost'), 'Por estimar');
  assert.equal(needReportValue({ estimated_cost: 0 }, 'estimated_cost'), 0);
  assert.equal(needReportValue({ planned_start_date: null, planned_date: null }, 'planned_start_date'), 'Por planificar');
  assert.equal(needReportValue({ quarter: 'Q2' }, 'quarter'), 'Trimestre 2');
});
