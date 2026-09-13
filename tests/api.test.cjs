const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');

const source = fs.readFileSync(path.join(__dirname, '../frontend/src/types/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

function requestWith(fetch) {
  const context = vm.createContext({ exports: {}, fetch });
  vm.runInContext(compiled, context);
  return context.exports.apiRequest;
}

for (const status of [404, 401, 403, 429, 500]) {
  test('HTTP ' + status + ' never displays the raw server response', async () => {
    const api = requestWith(async () => ({
      ok: false, status,
      json() { throw Error('must not read body'); },
      text() { throw Error('must not read body'); }
    }));
    await assert.rejects(api({ action: 'login' }), error => {
      assert.ok(error.message.includes(String(status)));
      assert.ok(error.message.length < 180);
      assert.equal(error.message.includes('<'), false);
      return true;
    });
  });
}

test('HTML returned with HTTP 200 has a concise error', async () => {
  const api = requestWith(async () => ({ ok: true, json() { throw Error('<html>private response</html>'); } }));
  await assert.rejects(api({ action: 'login' }), error => {
    assert.equal(error.message.includes('private response'), false);
    assert.equal(error.message.includes('<html>'), false);
    return true;
  });
});

for (const data of [null, [], {}, { success: 'true' }]) {
  test('reject malformed JSON response: ' + JSON.stringify(data), async () => {
    const api = requestWith(async () => ({ ok: true, json: async () => data }));
    await assert.rejects(api({ action: 'login' }));
  });
}

test('preserve normal successful and failed API results', async () => {
  for (const success of [true, false]) {
    const expected = { success, message: 'backend message' };
    const api = requestWith(async () => ({ ok: true, json: async () => expected }));
    assert.equal(await api({ action: 'login' }), expected);
  }
});

test('network error does not expose internal error details', async () => {
  const api = requestWith(async () => { throw Error('internal details'); });
  await assert.rejects(api({ action: 'login' }), error => !error.message.includes('internal details'));
});
