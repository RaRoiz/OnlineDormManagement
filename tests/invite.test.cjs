const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');

const source = fs.readFileSync(path.join(__dirname, '../frontend/src/utils/invite-link.ts'), 'utf8');
const context = vm.createContext({ exports: {}, URL });
vm.runInContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, context);
const buildLink = context.exports.buildStaffInviteLink;

test('default invite points to the public Vercel site and preserves special characters', () => {
  const code = 'invite+&?#/รหัส';
  const url = new URL(buildLink(code, ''));
  assert.equal(url.origin, 'https://online-dorm-management-nwfw.vercel.app');
  assert.equal(url.pathname, '/src/pages/register/register.html');
  assert.equal(url.searchParams.get('code'), code);
  assert.equal(url.hash, '');
});

test('configured frontend URL takes precedence and preserves base path', () => {
  assert.equal(new URL(buildLink('code', 'https://example.com/dorm')).pathname,
    '/dorm/src/pages/register/register.html');
});

test('reject empty codes and invalid or loopback frontend URLs', () => {
  assert.throws(() => buildLink('  ', ''));
  for (const url of ['http://localhost:5173', 'http://127.0.0.1', 'http://127.1',
    'http://[::1]', 'http://app.localhost', 'javascript:alert(1)', 'not a url',
    'https://user:password@example.com', 'https://example.com/?key=value']) {
    assert.throws(() => buildLink('code', url));
  }
});

function backend(options = {}) {
  let propertyReads = 0;
  const c = vm.createContext({});
  for (const file of ['Admin.js', 'Settings.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend', file), 'utf8'), c);
  }
  c.validateToken = () => options.expired ? { success: false } :
    { success: true, user: { userId: 'user', role: 'OWNER' } };
  c.findOwnUserRow_ = () => ({
    targetRow: options.missing ? -1 : 2,
    index: { active: 0, role: 1 }, values: [[], [options.active !== false, options.role || 'OWNER']]
  });
  c.getOptionalProperty_ = name => {
    propertyReads++;
    return name === 'STAFF_SIGNUP_CODE' ? (options.noCode ? '' : 'test-invite') : '';
  };
  return { c, reads: () => propertyReads };
}

for (const role of ['OWNER', 'SUPER_ADMIN']) {
  test(role + ' can fetch the invite code', () => {
    const { c } = backend({ role });
    const result = c.getStaffInvite({ token: 'session' });
    assert.equal(result.success, true);
    assert.equal(result.data.signupCode, 'test-invite');
  });
}

for (const options of [{ role: 'USER' }, { active: false }, { expired: true }, { missing: true }]) {
  test('deny invite access before reading secrets: ' + JSON.stringify(options), () => {
    const { c, reads } = backend(options);
    assert.equal(c.getStaffInvite({ token: 'session' }).success, false);
    assert.equal(reads(), 0);
  });
}

test('missing signup code returns an actionable error without a blank invite', () => {
  const { c } = backend({ noCode: true });
  const result = c.getStaffInvite({ token: 'session' });
  assert.equal(result.success, false);
  assert.equal(result.data, undefined);
  assert.ok(result.message.includes('STAFF_SIGNUP_CODE'));
});

test('public dorm info does not reveal invite code', () => {
  const { c } = backend();
  c.getDormName_ = () => 'Dorm';
  assert.equal(JSON.stringify(c.getDormPublicInfo({})).includes('test-invite'), false);
});
