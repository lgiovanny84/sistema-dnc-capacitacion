import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import vm from 'node:vm';
const require=createRequire(import.meta.url),compiled=await build({entryPoints:[new URL('../src/SectionEditor.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const ctx={module:{exports:{}},exports:{},require};vm.runInNewContext(compiled.outputFiles[0].text,ctx);
const {editableFields}=ctx.module.exports;
test('section editing locks mutations until Editar while retaining disabled controls, validation and navigation',()=>{
 let changes=0;const original=React.createElement('div',null,React.createElement('input',{value:20,min:0,max:100,required:true,onChange:()=>changes++}),React.createElement('select',{value:'A',onChange:()=>changes++},React.createElement('option',null,'A')),React.createElement('input',{value:1,disabled:true,onChange:()=>changes++}),React.createElement('input',{'aria-label':'Buscar gasto',value:'',onChange:()=>changes++}));
 let root=editableFields(original,false)[0],fields=root.props.children;assert.equal(fields[0].props.readOnly,true);assert.equal(fields[0].props.required,true);assert.equal(fields[0].props.max,100);fields[0].props.onChange({});assert.equal(changes,0);
 let prevented=false;fields[1].props.onMouseDown({preventDefault(){prevented=true}});assert.equal(prevented,true);fields[1].props.onChange({});assert.equal(changes,0);assert.equal(fields[2].props.disabled,true);assert.equal(fields[3].props.readOnly,undefined);
 root=editableFields(original,true)[0];root.props.children[0].props.onChange({});assert.equal(changes,1);assert.equal(root.props.children[2].props.disabled,true);
});
test('double click enables the section and focuses the field selected, with an accessible Editar button alternative',()=>{
 let editing=false,focused=false;const fakeReact={...React,useState:()=>[editing,value=>editing=value],useRef:()=>({current:null}),useId:()=> 'section-id'};
 const context={module:{exports:{}},exports:{},requestAnimationFrame:fn=>fn(),require:name=>name==='react'?fakeReact:require(name)};vm.runInNewContext(compiled.outputFiles[0].text,context);
 const component=context.module.exports.SectionEditor;const field={focus(){focused=true},closest(selector){return selector.includes('input')?this:null}};
 const tree=component({title:'estructura',children:React.createElement('input',{value:'X',onChange(){}})});
 tree.props.onDoubleClick({target:field});assert.equal(editing,true);assert.equal(focused,true);
 const button=tree.props.children[0].props.children;assert.equal(button.props.type,'button');assert.equal(button.props['aria-label'],'Editar sección estructura');assert.equal(button.props['aria-controls'],'section-id');editing=false;button.props.onClick();assert.equal(editing,true);
});
