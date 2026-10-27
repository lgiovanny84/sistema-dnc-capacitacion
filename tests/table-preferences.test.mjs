import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),compiled=await build({entryPoints:[new URL('../src/tablePreferences.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs'});
function api(storage){const context={module:{exports:{}},exports:{},localStorage:storage,require};vm.runInNewContext(compiled.outputFiles[0].text,context);return context.module.exports;}
test('table presentation survives a new session, is isolated by account and screen, and stores only a boolean plus generation',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},a=api(storage),v={open:true,generation:a.nextTableGeneration()};a.saveTablePreference('account-a:needs','table-1',v);
 const b=api(storage);assert.equal(b.readTablePreference('account-a:needs','table-1').open,true);assert.equal(b.readTablePreference('account-b:needs','table-1'),null);assert.equal(b.readTablePreference('account-a:reports','table-1'),null);
 assert.ok([...data.keys()].every(k=>!k.includes('account-a')&&!k.includes('needs')));assert.deepEqual(Object.keys(JSON.parse([...data.values()][0])).sort(),['generation','open']);
 const global={open:false,generation:b.nextTableGeneration(v.generation)};assert.equal(b.resolvedTablePreference(v,global,true),false);const local={open:true,generation:b.nextTableGeneration(global.generation)};assert.equal(b.resolvedTablePreference(local,global,false),true);
});
test('blocked or corrupt local storage never prevents viewing or collapsing tables',()=>{
 const blocked=api({getItem(){throw Error('disabled')},setItem(){throw Error('disabled')}});assert.equal(blocked.readTablePreference('a','b'),null);assert.doesNotThrow(()=>blocked.saveTablePreference('a','b',{open:true,generation:1}));
 const corrupt=api({getItem:()=>'{',setItem(){}});assert.equal(corrupt.readTablePreference('a','b'),null);
});
