import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import vm from 'node:vm';
const result=await build({entryPoints:[new URL('../src/reportDates.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs'});
const context={module:{exports:{}},exports:{},Date,Intl};vm.runInNewContext(result.outputFiles[0].text,context);
const {reportDate,reportDateKeys,reportDateTimeKeys}=context.module.exports;
test('calendar dates use day/month/year without changing day for timezone or ISO time suffix',()=>{
 assert.equal(reportDate('2027-02-01'),'01/02/2027');assert.equal(reportDate('2027-12-30T00:00:00'),'30/12/2027');
 assert.equal(reportDate('Por planificar'),'Por planificar');assert.equal(reportDate(null),'');
 assert.ok(reportDateKeys.has('planned_start_date'));assert.ok(reportDateKeys.has('end'));
});
test('timestamp reports show padded Ecuador dates and times, including a UTC day boundary',()=>{
 assert.equal(reportDate('2027-01-01T02:03:04Z',true),'31/12/2026 21:03:04');
 assert.equal(reportDate(new Date('2027-06-08T15:09:10Z'),true),'08/06/2027 10:09:10');assert.equal(reportDate('Sin dato',true),'Sin dato');
 assert.ok(reportDateTimeKeys.has('created_at'));assert.ok(reportDateTimeKeys.has('updated_at'));
});
