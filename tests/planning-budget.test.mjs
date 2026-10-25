import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compiled = await build({ stdin: {contents: "export { BudgetSummary } from './trainingExecution'; export { BudgetContext } from './BudgetModule';", resolveDir: new URL('../src',import.meta.url).pathname,loader:'tsx'}, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'exceljs'], plugins: [{ name: 'no-live-database', setup(builder) {
  builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = null;', loader: 'js' }));
} }] });
const context = { exports: {}, module: { exports: {} }, require: createRequire(import.meta.url) };
vm.runInNewContext(compiled.outputFiles[0].text, context);
const { BudgetSummary, BudgetContext } = context.module.exports;
const record = { requesting_area: 'ADMINISTRACIÓN', cost: 10, duration: 2, status: 'Ejecutada' };
const plan = { id: 'need', department: 'Administración', estimated_cost: null, hours: null, participants: 4 };
const render = (plans) => renderToStaticMarkup(React.createElement(BudgetSummary, { plans, records: [record], budgets: [], periodName: '2027' }));

test('unestimated plans still cross actual expenses but do not show false zero budgets or completion percentages', () => {
  const html = render([plan]);
  assert.match(html, /Por estimar/);
  assert.match(html, /Pendiente de estimación/);
  assert.match(html, /Gastado/);
  assert.match(html, /10,00/);
  assert.doesNotMatch(html, /0\.0%/);
  assert.doesNotMatch(html, /Gastos sin cruce presupuestario/);
});
test('mixed planning shows known amounts as partial and defers balances and ratios', () => {
  const html = render([plan, { ...plan, id: 'estimated', estimated_cost: 800, hours: 8 }]);
  assert.match(html, /800,00/);
  assert.match(html, /parcial/);
  assert.match(html, /Pendiente de estimación/);
  assert.match(html, />32</);
});
test('a real zero cost remains a known estimate', () => {
  const html = render([{ ...plan, estimated_cost: 0, hours: 8 }]);
  assert.doesNotMatch(html, /Por estimar|Pendiente de estimación|parcial/);
  assert.match(html, /0,00/);
  assert.match(html, /6\.3%/);
});


test('independent budgets retain executed hours from external activities without a DNC plan',()=>{
 const payload={funds:[{name:'Institucional',cents:4000000},{name:'Broker',cents:0},{name:'Otros',cents:0}],nodes:[],links:[]};
 const html=renderToStaticMarkup(React.createElement(BudgetContext.Provider,{value:{period_id:'2027',revision:1,payload}},React.createElement(BudgetSummary,{plans:[],records:[record],budgets:[],periodName:'2027'})));
 assert.match(html,/Horas cumplidas<\/small><strong[^>]*>2<\/strong>/);
 assert.match(html,/Gasto total del período/);
});


test('hour fulfillment shows the actual percentage without truncating values above 999 percent',()=>{const html=renderToStaticMarkup(React.createElement(BudgetSummary,{plans:[{...plan,estimated_cost:0,hours:1,participants:1}],records:[{...record,duration:20}],budgets:[],periodName:'2027'}));assert.match(html,/2000\.0%/);assert.doesNotMatch(html,/999\.0%/);});
