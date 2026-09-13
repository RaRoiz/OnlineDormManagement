const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
function fixture(options = {}) {
  const fields = ['billId', 'billNo', 'tenantId', 'paymentStatus', 'paidAt', 'updatedAt', 'totalAmount'];
  const rows = [fields, ['b', 'INV-1', 't', 'PENDING', '', '', 100]];
  const history = [['billId', 'slipUrl', 'decision', 'reason', 'reviewedBy', 'recordedAt']];
  const index = Object.fromEntries(fields.map((key, i) => [key, i]));
  let locked = false;
  let url = 'old-slip';
  const sheet = { getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getRange: (r, col) => ({
      setValues: values => { rows[r - 1] = values[0].slice(); },
      setValue: value => { rows[r - 1][col - 1] = value; }
    }) };
  const historySheet = { getDataRange: () => ({ getValues: () => history }),
    appendRow: row => { if (options.historyFailure) throw Error('write failed'); history.push(row); } };
  const c = vm.createContext({
    authorizeSlipUser_: () => ({ success: !options.denied, user: { userId: 'admin' } }),
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false); locked = true; }, releaseLock() { locked = false; } }) },
    getBillsSheet_: () => sheet, getBillHeaderIndex_: () => index,
    getSlipUrlByBillId_: () => ({ b: url }),
    getSpreadsheet_: () => ({ getSheetByName: () => historySheet }),
    SpreadsheetApp: { flush() {} }, bumpDormCache_() {},
    hashPassword: (row, salt) => require('node:crypto').createHash('sha256').update(row + salt).digest('hex'),
    billFromRow_: row => Object.fromEntries(fields.map((key, i) => [key, row[i]])),
    findLineUserIdByTenantId_: () => 'line', getLineCredentials_: () => ({ token: 'token' }),
    pushLineMessage_() { assert.equal(locked, false); if (options.lineFailure) throw Error('LINE unavailable'); },
    findOldestUnpaidBillByTenantId_: () => null,
    savePaymentSlip_: (id, value) => { url = value; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend/SlipReview.js'), 'utf8'), c);
  const request = { billId: 'b', decision: 'APPROVED', reviewVersion: c.slipReviewVersion_(rows[1], url) };
  return { c, rows, history, request, locked: () => locked };
}
test('approval records reviewer and keeps the original slip reference', () => {
  const { c, rows, history, request, locked } = fixture();
  assert.equal(c.reviewBillSlip(request).success, true);
  assert.equal(rows[1][3], 'PAID');
  assert.equal(history[1][1], 'old-slip');
  assert.equal(history[1][4], 'admin');
  assert.equal(locked(), false);
  assert.equal(c.reviewBillSlip(request).success, false);
});
test('rejection requires reason and returns the same bill for resubmission', () => {
  const { c, rows, history, request } = fixture();
  request.decision = 'REJECTED';
  assert.equal(c.reviewBillSlip(request).success, false);
  request.reason = 'ยอดไม่ตรง';
  assert.equal(c.reviewBillSlip(request).success, true);
  assert.equal(rows[1][3], 'UNPAID');
  assert.equal(history[1][3], 'ยอดไม่ตรง');
  const target = c.selectSlipTarget_('t').target;
  assert.equal(target.bill.billId, 'b');
  c.recordIncomingSlip_(target, 'new-slip', 'line');
  assert.equal(rows[1][3], 'PENDING');
  assert.equal(history[1][1], 'old-slip');
  assert.equal(history[2][1], 'new-slip');
  assert.equal(history[2][2], 'SUBMITTED');
  assert.ok(c.selectSlipTarget_('t').message);
});
test('stale amount or slip cannot be approved', () => {
  const { c, rows, request } = fixture();
  rows[1][6] = 999;
  assert.equal(c.reviewBillSlip(request).success, false);
  assert.equal(rows[1][3], 'PENDING');
});
test('history failure restores bill and releases the lock', () => {
  const { c, rows, request, locked } = fixture({ historyFailure: true });
  assert.throws(() => c.reviewBillSlip(request));
  assert.equal(rows[1][3], 'PENDING');
  assert.equal(locked(), false);
});
test('LINE failure does not roll back payment approval', () => {
  const { c, rows, request } = fixture({ lineFailure: true });
  const result = c.reviewBillSlip(request);
  assert.equal(result.success, true);
  assert.ok(result.warning);
  assert.equal(rows[1][3], 'PAID');
});
test('unauthorized review cannot mutate billing data', () => {
  const { c, rows, request, history } = fixture({ denied: true });
  assert.equal(c.reviewBillSlip(request).success, false);
  assert.equal(rows[1][3], 'PENDING');
  assert.equal(history.length, 1);
});
