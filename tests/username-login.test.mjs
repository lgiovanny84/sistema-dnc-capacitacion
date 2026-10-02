import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/username-login/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function handler({ lookupError = null, profile = { id: 'account', email: 'account@example.test', active: true, deleted_at: null }, authError = null, userId = 'account', missingEnv = false } = {}) {
  let authCalls = 0;
  let lookupUsername;
  const logs = [];
  const client = {
    from: () => ({ select: () => ({ eq: (_key, value) => {
      lookupUsername = value;
      return { maybeSingle: async () => ({ data: profile, error: lookupError }) };
    } }) }),
    auth: { signInWithPassword: async () => {
      authCalls++;
      return { error: authError, data: { user: { id: userId }, session: { access_token: 'test-access', refresh_token: 'test-refresh' } } };
    } },
  };
  const context = {
    exports: {}, Request, Response,
    Deno: { env: { get: () => missingEnv ? undefined : 'test-config' } },
    console: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    require: () => ({ createClient: () => client }),
  };
  vm.runInNewContext(compiled, context);
  return {
    fetch: context.exports.default.fetch,
    authCalls: () => authCalls,
    lookupUsername: () => lookupUsername,
    logs,
  };
}

const loginRequest = (body = { username: 'lgiovanny84', password: 'test-password' }) => new Request('https://example.test/login', { method: 'POST', body: JSON.stringify(body) });

test('database permission errors are service failures and do not validate passwords', async () => {
  const h = handler({ lookupError: { code: '42501' } });
  const response = await h.fetch(loginRequest());
  assert.equal(response.status, 503);
  assert.equal(h.authCalls(), 0);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!JSON.stringify(h.logs).includes('test-password'));
});

test('absent, inactive and deleted profiles return the same response', async () => {
  for (const profile of [null, { active: false }, { active: true, deleted_at: '2026-01-01' }]) {
    const h = handler({ profile });
    assert.equal((await h.fetch(loginRequest())).status, 401);
    assert.equal(h.authCalls(), 0);
  }
});

test('auth rejections, limits and outages have distinct statuses', async () => {
  for (const [status, expected] of [[400, 401], [429, 429], [500, 503]]) {
    const h = handler({ authError: { status, code: 'test' } });
    assert.equal((await h.fetch(loginRequest())).status, expected);
  }
});

test('invalid identity cannot issue a session', async () => {
  const response = await handler({ userId: 'other-account' }).fetch(loginRequest());
  assert.equal(response.status, 503);
  assert.ok(!(await response.json()).access_token);
});

test('valid login normalizes usernames and returns a session', async () => {
  const h = handler();
  const response = await h.fetch(loginRequest({ username: ' LGiovanny84 ', password: 'test-password' }));
  assert.equal(h.lookupUsername(), 'lgiovanny84');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).access_token, 'test-access');
});

test('malformed requests and missing configuration fail safely', async () => {
  const h = handler();
  assert.equal((await h.fetch(new Request('https://example.test/login', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await h.fetch(loginRequest(null))).status, 400);
  assert.equal((await h.fetch(loginRequest({ username: 'abc', password: '' }))).status, 401);
  assert.equal((await handler({ missingEnv: true }).fetch(loginRequest())).status, 503);
});
