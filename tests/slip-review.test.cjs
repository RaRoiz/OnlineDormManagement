const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');

class Sheet {
  constructor(rows = []) { this.rows = structuredClone(rows); }
  getLastRow() { return this.rows.length; }
  getDataRange() { return { getValues: () => structuredClone(this.rows) }; }
  appendRow(row) { this.rows.push(Array.from(row)); }
  getRange(row, column, count = 1, width = 1) {
    return {
      getValues: () => this.rows.slice(row - 1, row - 1 + count).map(r => r.slice(column - 1, column - 1 + width)),
      setValue: value => { this.rows[row - 1][column - 1] = value; },
      setValues: values => values.forEach((r, i) => {
        r.forEach((v, j) => { this.rows[row - 1 + i][column - 1 + j] = v; });
      })
    };
  }
}

function fixture() {
  let held = false;
  const messages = [];
  const c = vm.createContext({
    console: { error() {} },
    Utilities: { getUuid: () => crypto.randomUUID() },
    SpreadsheetApp: { flush() {} },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(held, false); held = true; },
      releaseLock() { held = false; }
    }) }
  });
  for (const file of ['Bill.js', 'SlipReview.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend', file), 'utf8'), c);
  }
  const headers = Array.from(vm.runInContext('BILL_HEADERS', c));
  const index = Object.fromEntries(headers.map((key, i) => [key, i]));
  const billRow = (id, status, due) => headers.map(key => ({
    billId: id, billNo: 'INV-' + id, tenantId: 'tenant', tenantName: 'Tenant',
    roomId: 'room', roomNo: '101', meterId: 'meter-' + id, billingMonth: '2026-09',
    paymentStatus: status, dueDate: due, totalAmount: 5000, paidAt: '',
    createdAt: '2026-09-01', updatedAt: '2026-09-01'
  })[key] ?? 0);
  const bills = new Sheet([headers, billRow('bill', 'PENDING', '2026-09-10'), billRow('older', 'UNPAID', '2026-08-10')]);
  const slips = new Sheet([['billId', 'slipUrl', 'lineUserId', 'submittedAt'],
    ['bill', 'https://drive.google.com/uc?export=view&id=original', 'line-user', '2026-09-01']]);
  const sheets = { Bills: bills, PaymentSlips: slips };
  c.getSpreadsheet_ = () => ({ getSheetByName: name => sheets[name] || null,
    insertSheet: name => (sheets[name] = new Sheet()) });
  c.getBillsSheet_ = () => bills;
  c.getPaymentSlipsSheet_ = () => slips;
  c.billFromRow_ = row => Object.fromEntries(headers.map((key, i) => [key, row[i]]));
  c.hashPassword = (data, salt) => crypto.createHash('sha256').update(salt + data).digest('hex');
  c.authorizeSlipUser_ = () => ({ success: true, user: { userId: 'reviewer' } });
  c.validateToken = c.authorizeSlipUser_;
  c.bumpDormCache_ = () => {};
  c.findLineUserIdByTenantId_ = () => 'line-user';
  c.getLineCredentials_ = () => ({ token: 'token' });
  c.pushLineMessage_ = (token, userId, payload) => {
    assert.equal(held, false);
    messages.push(payload[0].text);
  };
  const lineSource = fs.readFileSync(path.join(__dirname, '../backend/Line.js'), 'utf8');
  vm.runInContext(lineSource.slice(lineSource.indexOf('function savePaymentSlip_('),
    lineSource.indexOf('function handleSlipImageMessage_(')), c);
  const request = decision => ({ token: 'session', billId: 'bill', decision,
    reason: decision === 'REJECTED' ? 'ยอดไม่ตรง' : '',
    reviewVersion: c.slipReviewVersion_(bills.rows[1], slips.rows[1][1]) });
  return { c, bills, slips, sheets, index, messages, request, isLocked: () => held };
}

test('approve records reviewer and evidence, marks paid, and notifies after releasing lock', () => {
  const f = fixture();
  const result = f.c.reviewBillSlip(f.request('APPROVED'));
  assert.equal(result.success, true);
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'PAID');
  assert.ok(f.bills.rows[1][f.index.paidAt]);
  const event = f.sheets.SlipReviews.rows[1];
  assert.equal(event[4], 'APPROVED');
  assert.equal(event[6], 'reviewer');
  assert.equal(event[3], f.slips.rows[1][1]);
  assert.equal(f.messages.length, 1);
});

test('reject requires a reason and makes no changes when it is empty', () => {
  const f = fixture();
  assert.equal(f.c.reviewBillSlip({ ...f.request('REJECTED'), reason: ' ' }).success, false);
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'PENDING');
  assert.equal(f.sheets.SlipReviews, undefined);
});

test('reject then resubmit targets the same bill ahead of older arrears and preserves history', () => {
  const f = fixture();
  assert.equal(f.c.reviewBillSlip(f.request('REJECTED')).success, true);
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'UNPAID');
  assert.ok(f.messages[0].includes('ยอดไม่ตรง'));
  const target = f.c.selectSlipTarget_('tenant').target;
  assert.equal(target.bill.billId, 'bill');
  f.c.recordIncomingSlip_(target, 'https://drive.google.com/uc?export=view&id=replacement', 'line-user');
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'PENDING');
  assert.equal(f.bills.rows[2][f.index.paymentStatus], 'UNPAID');
  assert.equal(f.sheets.SlipReviews.rows[1][3].endsWith('original'), true);
  assert.equal(f.sheets.SlipReviews.rows[2][4], 'SUBMITTED');
  assert.equal(f.slips.rows[1][1].endsWith('replacement'), true);
});

test('pending bill blocks duplicate images from being assigned to another unpaid bill', () => {
  const f = fixture();
  const result = f.c.selectSlipTarget_('tenant');
  assert.ok(result.message);
  assert.equal(result.target, undefined);
});

test('stale bill or slip version cannot be approved', () => {
  for (const change of ['bill', 'slip']) {
    const f = fixture();
    const request = f.request('APPROVED');
    if (change === 'bill') f.bills.rows[1][f.index.totalAmount] = 6000;
    else f.slips.rows[1][1] += '-changed';
    assert.equal(f.c.reviewBillSlip(request).success, false);
    assert.equal(f.messages.length, 0);
    assert.equal(f.isLocked(), false);
  }
});

test('second review and manual payment bypass are rejected', () => {
  const f = fixture();
  assert.equal(f.c.markBillPaid({ token: 'session', billId: 'bill' }).success, false);
  const request = f.request('APPROVED');
  assert.equal(f.c.reviewBillSlip(request).success, true);
  assert.equal(f.c.reviewBillSlip(request).success, false);
  assert.equal(f.sheets.SlipReviews.rows.length, 2);
});

test('LINE failure does not undo a saved review and is returned as a warning', () => {
  const f = fixture();
  f.c.pushLineMessage_ = () => { throw Error('LINE unavailable'); };
  const result = f.c.reviewBillSlip(f.request('REJECTED'));
  assert.equal(result.success, true);
  assert.ok(result.warning);
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'UNPAID');
});

test('failed review history write restores bill state', () => {
  const f = fixture();
  f.c.appendSlipEvent_ = () => { throw Error('sheet unavailable'); };
  assert.throws(() => f.c.reviewBillSlip(f.request('APPROVED')));
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'PENDING');
  assert.equal(f.messages.length, 0);
  assert.equal(f.isLocked(), false);
});

test('unauthorized reviewers cannot mutate bills', () => {
  const f = fixture();
  f.c.authorizeSlipUser_ = () => ({ success: false });
  assert.equal(f.c.reviewBillSlip(f.request('APPROVED')).success, false);
  assert.equal(f.sheets.SlipReviews, undefined);
});

test('editing pending bill preserves its state and blocks changing the meter', () => {
  const f = fixture();
  f.c.validateBillInput_ = input => input;
  f.c.getBillMeterById_ = id => ({ meterId: id, roomId: 'room', tenantId: 'tenant',
    tenantName: 'Tenant', waterAmount: 100, electricAmount: 200, billingMonth: '2026-09' });
  f.c.getBillRoomById_ = () => ({ roomId: 'room', roomNo: '101', price: 4700 });
  f.c.formatSheetDate_ = value => value;
  const input = { meterId: 'meter-bill', depositAmount: 0, repairAmount: 0,
    damageAmount: 0, dueDate: '2026-09-10', note: 'updated note' };
  assert.equal(f.c.updateBill({ token: 'session', billId: 'bill', bill: input }).success, true);
  assert.equal(f.bills.rows[1][f.index.paymentStatus], 'PENDING');
  assert.equal(f.c.updateBill({ token: 'session', billId: 'bill', bill: { ...input, meterId: 'different' } }).success, false);
});

test('bill state is checked again before an in-flight upload is linked', () => {
  const f = fixture();
  f.c.reviewBillSlip(f.request('REJECTED'));
  const target = f.c.selectSlipTarget_('tenant').target;
  f.bills.rows[1][f.index.paymentStatus] = 'PAID';
  assert.throws(() => f.c.recordIncomingSlip_(target, 'replacement', 'line-user'));
  assert.equal(f.slips.rows[1][1].endsWith('original'), true);
});
