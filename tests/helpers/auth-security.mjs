import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
const source = readFileSync(new URL('../../supabase/functions/_shared/authSecurity.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context = {exports:{},crypto:webcrypto,TextEncoder,atob};
vm.runInNewContext(code,context);
export const authSecurity = context.exports;
