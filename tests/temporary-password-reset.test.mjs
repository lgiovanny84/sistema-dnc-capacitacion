import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const callerId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';

function setup({ callerRole = 'admin', callerActive = true, targetActive = true, targetRole = 'user', deleted = false, identityMatches = true, markFails = false, passwordFails = false, verificationFails = false } = {}) {
  const events = [];
  const logs = [];
  let issuedPassword;
  const target = { id: targetId, username: 'test-user', email: 'test@example.test', role: targetRole, active: targetActive, deleted_at: deleted ? '2026-01-01' : null };
  const caller = {
    auth: { getUser: async () => ({ data: { user: { id: callerId } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { role: callerRole, active: callerActive, deleted_at: null }, error: null }) }) }),
      update: (changes) => ({ eq: (_key, id) => ({ is: () => ({ select: () => ({ maybeSingle: async () => {
        events.push(['mark', id, changes.must_change_password]);
        return { data: markFails ? null : { id }, error: markFails ? { code: 'test' } : null };
      } }) }) }) }),
    }),
  };
  const admin = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: target, error: null }) }) }) }),
    auth: { admin: {
      getUserById: async () => ({ data: { user: { id: identityMatches ? targetId : callerId, email: target.email } }, error: null }),
      updateUserById: async (id, { password }) => {
        events.push(['password', id]);
        issuedPassword = password;
        return { error: passwordFails ? { code: 'test' } : null };
      },
    } },
  };
  const verifier = { auth: {
    signInWithPassword: async ({ email, password }) => {
      assert.equal(email, target.email);
      assert.equal(password, issuedPassword);
      events.push(['verify']);
      return { data: { user: { id: targetId }, session: verificationFails ? null : { access_token: 'test-session' } }, error: verificationFails ? { code: 'test' } : null };
    },
    signOut: async () => { events.push(['sign-out']); return { error: null }; },
  } };
  const context = {
    exports: {}, Request, Response, crypto: webcrypto, btoa,
    Deno: { env: { get: (key) => key } },
    console: { error: (...args) => logs.push(args) },
    require: () => ({ createClient: (_url, key, options) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : options?.global ? caller : verifier }),
  };
  vm.runInNewContext(compiled, context);
  return { fetch: context.exports.default.fetch, events, logs };
}

const request = (id = targetId, action = 'reset-temporary-password') => new Request('https://example.test/users', { method: 'POST', body: JSON.stringify({ action, userId: id, role: 'user' }) });

test('administrator receives a unique verified credential after setting mandatory change', async () => {
  const first = setup();
  const response = await first.fetch(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.temporaryPassword, /^[a-zA-Z0-9_-]{24}$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(data.username, 'test-user');
  assert.deepEqual(first.events, [['mark', targetId, true], ['password', targetId], ['verify'], ['sign-out']]);
  assert.ok(!JSON.stringify(first.logs).includes(data.temporaryPassword));
  const second = await setup().fetch(request());
  assert.notEqual(data.temporaryPassword, (await second.json()).temporaryPassword);
});

test('resetting an inactive user preserves its state', async () => {
  const h = setup({ targetActive: false });
  const response = await h.fetch(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).active, false);
});

test('ordinary and inactive callers cannot reset credentials', async () => {
  for (const options of [{ callerRole: 'user' }, { callerActive: false }]) {
    const h = setup(options);
    assert.equal((await h.fetch(request())).status, 403);
    assert.equal(h.events.length, 0);
  }
});

test('invalid, self, administrator, deleted and mismatched targets cannot be reset', async () => {
  for (const [options, id, expected] of [
    [{}, 'invalid', 400], [{}, callerId, 400],
    [{ targetRole: 'admin' }, targetId, 403], [{ deleted: true }, targetId, 404],
    [{ identityMatches: false }, targetId, 409],
  ]) {
    const h = setup(options);
    assert.equal((await h.fetch(request(id))).status, expected);
    assert.equal(h.events.length, 0);
  }
});

test('failed marking, password updates and validation do not disclose a password', async () => {
  for (const options of [{ markFails: true }, { passwordFails: true }, { verificationFails: true }]) {
    const h = setup(options);
    const response = await h.fetch(request());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).temporaryPassword, undefined);
    if (options.markFails) assert.equal(h.events.length, 1);
    if (options.passwordFails) assert.equal(h.events.length, 2);
  }
});

test('unsupported actions and malformed bodies are rejected', async () => {
  const h = setup();
  assert.equal((await h.fetch(request(targetId, 'unsupported'))).status, 400);
  assert.equal((await h.fetch(new Request('https://example.test/users', { method: 'POST', body: 'null' }))).status, 400);
  assert.equal(h.events.length, 0);
});
