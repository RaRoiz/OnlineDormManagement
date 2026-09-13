const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function backend(role) {
  const c = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: () => JSON.stringify({ userId: 'u', role }) }) }
  });
  for (const file of ['Admin.js', 'Auth.js', 'Performance.js']) vm.runInContext(read('backend/' + file), c);
  return c;
}

for (const role of ['ADMIN', 'SUPER_ADMIN', ' super_admin ']) {
  test(role + ' retains admin and owner permissions with a canonical session role', () => {
    const c = backend(role);
    assert.equal(c.validateToken('session').user.role, 'ADMIN');
    assert.equal(c.adminOnly_({ token: 'session' }, () => 'allowed'), 'allowed');
    assert.equal(c.ownerOnly_({ token: 'session' }, () => 'allowed'), 'allowed');
  });
}

for (const role of ['OWNER', 'USER', 'VISITOR', '']) {
  test(role + ' cannot enter admin endpoints', () => {
    const c = backend(role);
    assert.equal(c.adminOnly_({ token: 'session' }, () => assert.fail('privilege escalation')).success, false);
  });
}

test('frontend reads old sessions as ADMIN without promoting staff', () => {
  let role = 'SUPER_ADMIN';
  const c = vm.createContext({ exports: {}, require: () => ({}), sessionStorage: {
    getItem: () => JSON.stringify({ userId: 'u', role }), removeItem() {}
  } });
  vm.runInContext(ts.transpileModule(read('frontend/src/services/auth.service.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, c);
  assert.equal(c.exports.getCurrentUser().role, 'ADMIN');
  assert.equal(c.exports.isAdmin(), true);
  assert.equal(c.exports.isOwner(), true);
  assert.equal(c.exports.roleLabel('SUPER_ADMIN'), 'ADMIN');
  role = 'USER';
  assert.equal(c.exports.isAdmin(), false);
  assert.equal(c.exports.isOwner(), false);
});

test('migration changes only legacy roles and is safe to run again', () => {
  const rows = [['username', 'role', 'passwordHash'], ['original', 'SUPER_ADMIN', 'hash'],
    ['owner', 'OWNER', 'keep'], ['staff', 'USER', 'keep'], ['admin', 'ADMIN', 'keep']];
  let released = 0;
  const c = vm.createContext({
    console: { log() {} }, SpreadsheetApp: { flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released++; } }) },
    createHeaderIndex: () => ({ role: 1 }),
    getUsersSheet_: () => ({ getDataRange: () => ({ getValues: () => rows }),
      getRange: (row, col) => ({ setValue: value => { rows[row - 1][col - 1] = value; } }) })
  });
  vm.runInContext(read('backend/RoleMigration.js'), c);
  assert.equal(c.migrateSuperAdminRoleToAdmin().updated, 1);
  assert.deepEqual(rows[1], ['original', 'ADMIN', 'hash']);
  assert.equal(rows[2][1], 'OWNER');
  assert.equal(rows[3][1], 'USER');
  assert.equal(c.migrateSuperAdminRoleToAdmin().updated, 0);
  assert.equal(released, 2);
});
