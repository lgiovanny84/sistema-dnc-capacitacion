import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ExcelJS=require('exceljs');
const result=await build({entryPoints:[new URL('../src/institutionalExcel.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'excel-external',setup(builder){builder.onResolve({filter:/^exceljs$/},()=>({path:'exceljs',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export default globalThis.__ExcelJS;',loader:'js'}))}}]});
const context={module:{exports:{}},exports:{},__ExcelJS:ExcelJS,Date,Intl,console};vm.runInNewContext(result.outputFiles[0].text,context);
const {buildInstitutionalWorkbook,buildNeedsWorkbook}=context.module.exports;
test('institutional export retains numeric amounts/dates, Spanish metadata, filters, branding and recalculable filtered totals',async()=>{
 const book=await buildInstitutionalWorkbook({title:'Capacitaciones recibidas',sheetName:'Capacitaciones',periodName:'2027',periodStart:'2027-01-01',periodEnd:'2027-12-31',filters:'Departamento: Talento Humano',source:'Registros cargados',summary:'Dos actividades',generatedAt:new Date('2026-10-23T15:00:00Z'),columns:[{key:'topic',label:'Tema',width:40},{key:'cost',label:'Costo (USD)',type:'money',total:true,missing:'Por estimar'},{key:'hours',label:'Horas',type:'number',total:true},{key:'date',label:'Fecha de inicio',type:'date'},{key:'registered',label:'Registro',type:'datetime'}],rows:[{topic:'=HYPERLINK("unsafe")',cost:800.25,hours:1.5,date:'2027-02-01',registered:'2026-10-23T15:00:00Z'},{topic:'Liderazgo',cost:0,hours:2,date:null}]});
 const bytes=await book.xlsx.writeBuffer();const saved=new ExcelJS.Workbook();await saved.xlsx.load(bytes);const sheet=saved.worksheets[0];
 assert.match(sheet.getCell('D1').value,/ATUNTAQUI/);assert.match(sheet.getCell('A4').value,/2027/);assert.match(sheet.getCell('A5').value,/Talento Humano/);
 assert.equal(sheet.getCell('B10').value,800.25);assert.equal(sheet.getCell('B11').value,0);assert.equal(sheet.getCell('C10').value,1.5);
 assert.equal(sheet.getCell('A10').value,'=HYPERLINK("unsafe")');assert.equal(sheet.getCell('A10').formula,undefined,'text must not execute as a formula');
 assert.equal(sheet.getCell('D10').value.toISOString(),'2027-02-01T00:00:00.000Z');assert.equal(sheet.getCell('E10').value.toISOString(),'2026-10-23T10:00:00.000Z');
 assert.equal(sheet.views[0].ySplit,9);assert.deepEqual(sheet.autoFilter,'A9:E11');
 assert.equal(sheet.getCell('B13').formula,'SUBTOTAL(109,B10:B11)');assert.equal(sheet.getCell('B13').result,800.25);assert.equal(sheet.getCell('C13').result,3.5);
 assert.equal(sheet.pageSetup.orientation,'landscape');assert.match(sheet.getCell('B10').numFmt,/USD/);
});
test('needs export preserves unknown values, includes pending fields and keeps indicator immediately before expected goal',async()=>{
 const book=await buildNeedsWorkbook([{id:'need',competency:'Análisis',occupational_group:'COLABORADORES',participants:2,hours:null,estimated_cost:null,indicator:'',goal:'',quarter:null}],{name:'2027'},'Grupo ocupacional: COLABORADORES');
 const buffer=await book.xlsx.writeBuffer();const saved=new ExcelJS.Workbook();await saved.xlsx.load(buffer);const sheet=saved.worksheets[0];
 const headers=sheet.getRow(9).values.slice(1);const indicator=headers.indexOf('Indicador')+1;const cost=headers.indexOf('Costo estimado (USD)')+1;
 assert.equal(headers[indicator],'Meta esperada');assert.equal(sheet.getCell(10,indicator).value,'Por definir');assert.equal(sheet.getCell(10,cost).value,'Por estimar');
 assert.equal(sheet.getCell(12,cost).value,'Por estimar');assert.match(sheet.getCell(10,headers.indexOf('Datos por completar')+1).value,/Indicador; Meta esperada/);
});
test('empty filtered exports contain an explicit empty message and no fabricated zero totals or invalid formulas',async()=>{
 const book=await buildNeedsWorkbook([],{name:'2027'},'Área: Crédito');const sheet=book.worksheets[0];
 assert.match(sheet.getCell('A10').value,/No existen registros/);assert.equal(sheet.autoFilter,null);
 const values=sheet.getRow(12).values;assert.ok(values.includes('Por estimar'));assert.ok(!values.some(value=>value&&typeof value==='object'&&'formula' in value));
});
