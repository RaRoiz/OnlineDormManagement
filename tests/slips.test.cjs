const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');

function fixture(options = {}) {
  const events = [];
  const iterator = items => {
    let i = 0;
    return { hasNext: () => i < items.length, next: () => items[i++] };
  };
  const folder = {
    getId: () => 'folder',
    getSharingAccess: () => options.folderAccess || 'PRIVATE',
    getViewers: () => [], getEditors: () => [],
    getParents: () => iterator([])
  };
  let access = 'ANYONE_WITH_LINK';
  const file = {
    isTrashed: () => false,
    getSize: () => options.size || 100,
    getParents: () => iterator([folder]),
    getSharingAccess: () => access,
    getViewers: () => options.explicitViewer ? ['someone'] : [],
    getEditors: () => [],
    setSharing(value) { events.push('restrict'); access = value; },
    getBlob() {
      events.push('blob');
      return { getContentType: () => options.mime || 'image/png', getBytes: () => [1, 2, 3] };
    }
  };
  const slipUrl = options.url || 'https://drive.google.com/uc?export=view&id=slip-file';
  const c = vm.createContext({
    console: { log() {} },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' }, Permission: { VIEW: 'VIEW' },
      getFileById(id) { events.push('file:' + id); return file; }
    },
    Utilities: { base64Encode: bytes => Buffer.from(bytes).toString('base64') },
    validateToken: () => options.noSession
      ? { success: false, message: 'expired' }
      : { success: true, user: { userId: 'user', role: 'OWNER' } },
    findOwnUserRow_: () => {
      events.push('account');
      return {
        targetRow: options.missingUser ? -1 : 2,
        index: { role: 0, active: 1 },
        values: [[], [options.role || 'USER', options.active !== false]]
      };
    },
    getBillsSheet_: () => ({ getDataRange: () => ({ getValues: () => [['billId'], ['bill']] }) }),
    getBillHeaderIndex_: () => ({ billId: 0 }),
    getSlipUrlByBillId_: () => options.noSlip ? {} : { bill: slipUrl },
    getSpreadsheet_: () => ({ getSheetByName: () => ({
      getDataRange: () => ({ getValues: () => [['billId', 'slipUrl'], ['bill', slipUrl]] })
    }) })
  });
  for (const name of ['Admin.js', 'Slips.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend', name), 'utf8'), c);
  }
  return { c, events, file, folder };
}

for (const role of ['OWNER', 'SUPER_ADMIN', 'USER']) {
  test(role + ' receives image bytes, not a Drive URL', () => {
    const { c, events } = fixture({ role });
    const result = c.getBillSlip({ token: 'session', billId: 'bill', fileId: 'unrelated' });
    assert.equal(result.success, true);
    assert.equal(result.data.mimeType, 'image/png');
    assert.equal(result.data.base64Data, 'AQID');
    assert.equal(JSON.stringify(result).includes('drive.google.com'), false);
    assert.deepEqual(events, ['account', 'file:slip-file', 'blob']);
  });
}

for (const options of [{ noSession: true }, { missingUser: true }, { active: false }, { role: 'VISITOR' }]) {
  test('deny before accessing Drive: ' + JSON.stringify(options), () => {
    const { c, events } = fixture(options);
    assert.equal(c.getBillSlip({ token: 'session', billId: 'bill' }).success, false);
    assert.equal(events.some(e => e.startsWith('file:')), false);
  });
}

test('unknown bill and absent slip never access Drive', () => {
  for (const [options, billId] of [[{}, 'missing'], [{ noSlip: true }, 'bill']]) {
    const { c, events } = fixture(options);
    assert.equal(c.getBillSlip({ token: 'session', billId }).success, false);
    assert.equal(events.some(e => e.startsWith('file:')), false);
  }
});

test('reject external URLs rather than fetching them', () => {
  const { c, events } = fixture({ url: 'https://example.com/private' });
  assert.throws(() => c.getBillSlip({ token: 'session', billId: 'bill' }));
  assert.equal(events.some(e => e.startsWith('file:')), false);
});

test('reject large files before reading bytes and reject active content', () => {
  const large = fixture({ size: 11 * 1024 * 1024 });
  assert.equal(large.c.getBillSlip({ token: 'session', billId: 'bill' }).success, false);
  assert.equal(large.events.includes('blob'), false);
  const svg = fixture({ mime: 'image/svg+xml' });
  assert.equal(svg.c.getBillSlip({ token: 'session', billId: 'bill' }).success, false);
});

test('preview does not change permissions, migration restricts linked slips', () => {
  const { c, events } = fixture();
  assert.equal(c.previewSlipPrivacyMigration().results[0].status, 'ready');
  assert.equal(events.includes('restrict'), false);
  assert.equal(c.restrictExistingPaymentSlips().results[0].status, 'restricted');
  assert.equal(events.filter(e => e === 'restrict').length, 1);
});

test('migration reports shared parents and explicit viewers without broad permission changes', () => {
  for (const options of [{ folderAccess: 'ANYONE_WITH_LINK' }, { explicitViewer: true }]) {
    const { c, events } = fixture(options);
    assert.equal(c.restrictExistingPaymentSlips().results[0].status, 'failed');
    assert.equal(events.includes('restrict'), false);
  }
});

for (const failure of ['', 'folder', 'permissions']) {
  test('new slip upload: ' + (failure || 'private file saved'), () => {
    const { c } = fixture();
    const source = fs.readFileSync(path.join(__dirname, '../backend/Line.js'), 'utf8');
    // Load only the handler; local Line.js may contain deployment-specific credentials.
    vm.runInContext(source.slice(source.indexOf('function handleSlipImageMessage_('),
      source.indexOf('const PROMPTPAY_AID_')), c);
    const events = [];
    const messages = [];
    c.console = { error() {} };
    c.findTenantIdByLineUserId_ = () => 'tenant';
    c.findOldestUnpaidBillByTenantId_ = () => ({
      bill: { billId: 'bill' }, row: 1, index: { paymentStatus: 0 },
      sheet: { getRange: () => ({ setValue(value) { events.push(value); } }) }
    });
    c.UrlFetchApp = { fetch: () => ({
      getResponseCode: () => 200,
      getBlob: () => ({ getBytes: () => [1, 2, 3] })
    }) };
    c.getSlipFolder_ = () => ({ createFile() {
      events.push('create');
      return { getId: () => 'new-slip', setTrashed() { events.push('trash'); } };
    } });
    c.assertSlipFolderPrivate_ = () => { if (failure === 'folder') throw Error('shared'); };
    c.restrictSlipFile_ = () => {
      events.push('restrict');
      if (failure === 'permissions') throw Error('denied');
    };
    c.savePaymentSlip_ = () => events.push('save');
    c.bumpDormCache_ = () => events.push('invalidate');
    c.replyLineMessage_ = (token, replyToken, message) => messages.push(message[0].text);
    c.handleSlipImageMessage_({ source: { userId: 'line-user' }, message: { id: 'image' }, replyToken: 'reply' }, 'token');
    if (!failure) {
      assert.deepEqual(events, ['create', 'restrict', 'save', 'PENDING', 'invalidate']);
      assert.ok(messages[0].includes('ได้รับสลิปแล้ว'));
    } else {
      assert.equal(events.includes('save'), false);
      assert.equal(events.includes('PENDING'), false);
      assert.equal(events.includes('trash'), failure === 'permissions');
      assert.ok(messages[0].includes('บันทึกสลิปไม่สำเร็จ'));
    }
  });
}
