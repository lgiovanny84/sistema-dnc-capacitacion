import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup({ active = true, passwordFails = false, completionFails = false } = {}) {
  const calls = [];
  const caller = {
    auth: { getUser: async () => ({ data: { user: { id: 'signed-in-account' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'user', active, deleted_at: null }, error: null }) }) }) }),
    rpc: () => { throw Error('Client must not mark first login complete'); },
  };
  const admin = {
    auth: { admin: { updateUserById: async (id) => {
      calls.push(['password', id]);
      return { error: passwordFails ? { message: 'rejected' } : null };
    } } },
    rpc: async (name, args) => {
      calls.push(['completion', name, args.p_user_id]);
      return { error: completionFails ? { code: 'test' } : null };
    },
  };
  const context = {
    exports: {}, Request, Response,
    Deno: { env: { get: (name) => name } },
    console: { error: () => {} },
    require: () => ({ createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : caller }),
  };
  vm.runInNewContext(code, context);
  return { fetch: context.exports.default.fetch, calls };
}

const request = () => new Request('https://example.test/users', { method: 'POST', body: JSON.stringify({ action: 'complete-first-login', password: 'test-only-password', p_user_id: 'other-account' }) });

test('only backend completes first login for the authenticated identity after password update', async () => {
  const h = setup();
  assert.equal((await h.fetch(request())).status, 200);
  assert.deepEqual(h.calls, [['password', 'signed-in-account'], ['completion', 'finish_first_login_for_user', 'signed-in-account']]);
});

test('failed password updates do not clear the requirement', async () => {
  const h = setup({ passwordFails: true });
  assert.equal((await h.fetch(request())).status, 400);
  assert.equal(h.calls.length, 1);
});

test('inactive accounts are blocked and failed completion is not reported as success', async () => {
  const inactive = setup({ active: false });
  assert.equal((await inactive.fetch(request())).status, 403);
  assert.equal(inactive.calls.length, 0);
  assert.equal((await setup({ completionFails: true }).fetch(request())).status, 500);
});
