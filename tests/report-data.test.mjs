import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import vm from 'node:vm';
const code=await build({entryPoints:[new URL('../src/reportData.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'fake-db',setup(builder){builder.onResolve({filter:/^\.\/supabase$/},()=>({path:'database',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase = globalThis.__database;',loader:'js'}))}}]});
function helper(rows,failingPage=-1){
 const requests=[],orders=[];
 const context={
  module:{exports:{}},exports:{},
  __database:{from(table){return {
   select(){return this},
   order(field){orders.push(field);return this},
   async range(from,to){
    requests.push({table,from,to});
    return Math.floor(from/1000)===failingPage
     ? {data:null,error:{message:'network'}}
     : {data:rows.slice(from,to+1),error:null};
   },
  }}},
 };
 vm.runInNewContext(code.outputFiles[0].text,context);return{fetch:context.module.exports.fetchAllReportRows,requests,orders};
}
test('reports and summary totals load all pages beyond the default row cap with a stable id tie-breaker',async()=>{
 const h=helper(Array.from({length:2401},(_,id)=>({id})));const r=await h.fetch('training_needs',[{field:'created_at',ascending:false}]);
 assert.equal(r.data.length,2401);assert.equal(r.data[2400].id,2400);assert.equal(h.requests.length,3);assert.equal(h.requests[2].from,2000);assert.equal(h.orders.filter(name=>name==='id').length,3);
});
test('a failed later page is reported rather than presenting a truncated export as complete',async()=>{
 const h=helper(Array.from({length:1400},(_,id)=>({id})),1);const r=await h.fetch('training_records',[{field:'start_date',ascending:false}]);
 assert.equal(r.data.length,1000);assert.equal(r.error.message,'network');assert.equal(h.requests.length,2);
});
