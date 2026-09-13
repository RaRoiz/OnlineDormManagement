const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function backend(failure) {
  const row = ['old-url', 'old', true];
  const events = [];
  let failWrite = failure === 'sheet';
  const bytes = [255,216,255,0,0,0,0,0,0,0,0,0];
  const c = vm.createContext({
    Logger: { log() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { base64Decode: () => bytes, base64Encode: () => 'image', newBlob: () => ({}) },
    SpreadsheetApp: { flush: () => events.push('flush') },
    CacheService: { getScriptCache: () => ({ put() { if (failure === 'cache') throw Error('cache'); } }) },
    DriveApp: { Access: { ANYONE_WITH_LINK: 'public' }, Permission: { VIEW: 'view' }, getFileById(id) {
      events.push('read:' + id);
      return { setTrashed() { events.push('trash:' + id); }, isTrashed: () => false,
        getSize: () => 12, getBlob: () => ({ getBytes: () => bytes }) };
    } }
  });
  for (const file of ['Auth.js', 'Admin.js', 'Avatars.js']) vm.runInContext(read('backend/' + file), c);
  c.validateToken = () => ({ success: failure !== 'auth', user: { userId: 'me', avatarUrl: 'old-url' } });
  c.findOwnUserRow_ = () => ({ targetRow: 2, values: [[], row.slice()], index: { avatarUrl: 0, avatarFileId: 1, active: 2 },
    sheet: { getRange: (r, col) => ({ setValue(value) {
      if (failWrite && col === 2) { failWrite = false; throw Error('sheet'); }
      row[col - 1] = value;
    } }) } });
  c.getAvatarFolder_ = () => ({ createFile: () => ({ getId: () => 'new',
    setSharing() { if (failure === 'sharing') throw Error('sharing'); },
    setTrashed() { events.push('trash:new'); }
  }) });
  return { c, row, events };
}
for (const failure of ['sharing', 'sheet', 'cache']) test('preserves old avatar on ' + failure + ' failure', () => {
  const { c, row, events } = backend(failure);
  try { assert.equal(c.uploadAvatar({ token: 't', base64Data: 'image' }).success, false); }
  catch (error) { assert.equal(error.message, failure); }
  assert.deepEqual(row, ['old-url', 'old', true]);
  assert.equal(events.includes('trash:old'), false);
  assert.equal(events.includes('trash:new'), true);
});
test('successful upload deletes old image only after persistence', () => {
  const { c, row, events } = backend();
  assert.equal(c.uploadAvatar({ token: 't', base64Data: 'image' }).success, true);
  assert.equal(row[1], 'new');
  assert.ok(events.indexOf('trash:old') > events.indexOf('flush'));
});
test('avatar endpoint ignores client supplied file ID', () => {
  const { c, events } = backend();
  assert.equal(c.getOwnAvatar({ token: 't', fileId: 'someone-else' }).success, true);
  assert.deepEqual(events, ['read:old']);
});
test('expired session cannot access Drive', () => {
  const { c, events } = backend('auth');
  assert.equal(c.getOwnAvatar({}).success, false);
  assert.deepEqual(events, []);
});
test('crop stays within portrait and landscape images at all slider extremes', () => {
  const c = vm.createContext({ exports: {}, require: () => ({}) });
  vm.runInContext(ts.transpileModule(read('frontend/src/utils/avatar-crop.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, c);
  for (const [w, h] of [[400, 900], [900, 400], [512, 512]]) {
    for (const z of [1, 2, 3]) for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) {
      const r = c.exports.cropRect(w, h, z, x, y);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.size <= w && r.y + r.size <= h);
    }
  }
});

test('image loading failure keeps fallback; profile updates refresh visible avatars', async () => {
  let fail = true;
  const handlers = {};
  const images = [];
  let requests = 0;
  const c = vm.createContext({ exports: {}, window: { addEventListener: (name, fn) => { handlers[name] = fn; } },
    Image: class { constructor() { this.style = {}; images.push(this); } },
    require: name => name.includes('auth.service') ? {
      getToken: () => 'session', getCurrentUser: () => ({ userId: 'me', avatarUrl: 'new' })
    } : { apiRequest: async () => {
      requests++;
      if (fail) throw Error('network');
      return { success: true, data: { mimeType: 'image/png', base64Data: 'AQ==' } };
    } }
  });
  vm.runInContext(ts.transpileModule(read('frontend/src/utils/avatar.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, c);
  const container = { classList: { add() {}, remove() {} }, style: {}, isConnected: true,
    replaceChildren(img) { this.image = img; this.textContent = ''; } };
  c.exports.renderAvatar(container, { userId: 'me', avatarUrl: 'old' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(container.textContent, '👤');
  assert.match(container.title, /โหลดรูปไม่สำเร็จ/);
  fail = false;
  handlers['profile-updated']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(container.textContent, '👤');
  images[0].onload();
  assert.equal(container.image, images[0]);
  assert.equal(requests, 2);
});
