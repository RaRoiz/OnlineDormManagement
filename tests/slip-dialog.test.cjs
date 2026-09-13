const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');

const source = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/bill/bill.ts'), 'utf8');
const compiled = ts.transpileModule(source.slice(source.indexOf('async function openBillSlip('),
  source.indexOf('async function handleBillAction(')), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; }
  setAttribute() {}
  append(...elements) { this.children.push(...elements); }
  addEventListener(event, callback) { (this.listeners[event] ||= []).push(callback); }
  async emit(event) { for (const callback of this.listeners[event] || []) await callback({ preventDefault() {} }); }
  showModal() { this.open = true; }
  close() { this.open = false; void this.emit('close'); }
  focus() { this.focused = true; }
  remove() { this.removed = true; }
}

async function fixture(options = {}) {
  const elements = [];
  const calls = [];
  const notices = [];
  const context = vm.createContext({
    document: { createElement(tag) { const el = new Element(tag); elements.push(el); return el; }, body: new Element('body') },
    Blob, Uint8Array, atob,
    URL: { createObjectURL: () => 'blob:slip', revokeObjectURL() {} },
    formatMoney: value => String(value),
    showToast: message => notices.push(message),
    loadData: async () => {},
    getBillSlip: async () => ({ success: true, data: {
      mimeType: 'image/png', base64Data: 'AQID', reviewVersion: 'version',
      billNo: 'INV-1', totalAmount: 5000, paymentStatus: 'PENDING'
    } }),
    reviewBillSlip: async (...args) => {
      calls.push(args);
      return options.fail ? { success: false, message: 'ข้อมูลบิลเปลี่ยนแล้ว' } :
        { success: true, message: 'saved' };
    }
  });
  vm.runInContext(compiled, context);
  await context.openBillSlip({ billId: 'bill', billNo: 'INV-1' }, new Element('button'));
  const byText = text => elements.find(el => el.textContent === text);
  return {
    calls, notices, elements, byText,
    dialog: elements.find(el => el.tag === 'dialog'),
    image: elements.find(el => el.tag === 'img'),
    reason: elements.find(el => el.tag === 'textarea')
  };
}

test('review dialog shows amount and disables decisions until the image loads', async () => {
  const f = await fixture();
  assert.ok(f.byText('ยอดที่ต้องชำระ 5000'));
  assert.equal(f.byText('ยืนยันการชำระเงิน').disabled, true);
  await f.byText('ยืนยันการชำระเงิน').emit('click');
  assert.equal(f.calls.length, 0);
  await f.image.emit('load');
  assert.equal(f.byText('ยืนยันการชำระเงิน').disabled, false);
});

test('reject requires reason, then sends rejection with the viewed slip version', async () => {
  const f = await fixture();
  await f.image.emit('load');
  await f.byText('ปฏิเสธสลิป').emit('click');
  assert.equal(f.calls.length, 0);
  assert.equal(f.reason.focused, true);
  f.reason.value = 'ยอดไม่ตรง';
  await f.byText('ปฏิเสธสลิป').emit('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls[0], ['bill', 'version', 'REJECTED', 'ยอดไม่ตรง']);
  assert.equal(f.dialog.open, false);
});

test('approve sends approval once and closes on success', async () => {
  const f = await fixture();
  await f.image.emit('load');
  const approve = f.byText('ยืนยันการชำระเงิน');
  void approve.emit('click');
  void approve.emit('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][2], 'APPROVED');
  assert.equal(f.dialog.open, false);
});

test('API rejection remains visible in the dialog', async () => {
  const f = await fixture({ fail: true });
  await f.image.emit('load');
  await f.byText('ยืนยันการชำระเงิน').emit('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.dialog.open, true);
  assert.ok(f.byText('ข้อมูลบิลเปลี่ยนแล้ว'));
});
