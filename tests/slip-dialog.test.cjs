const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/bill/bill.ts'), 'utf8');
const script = ts.transpileModule(source.slice(source.indexOf('async function openBillSlip('), source.indexOf('async function handleBillAction(')), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.value = ''; this.textContent = ''; }
  append(...elements) { this.children.push(...elements); }
  setAttribute() {}
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  emit(name) { for (const fn of this.events[name] || []) fn({ preventDefault() {} }); }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  remove() {}
  focus() {}
}
async function fixture(options = {}) {
  const elements = [], calls = [], messages = [];
  const c = vm.createContext({
    document: { body: new Element('body'), createElement(tag) { const el = new Element(tag); elements.push(el); return el; } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, Blob, Uint8Array, atob,
    showToast: text => messages.push(text), loadData: async () => {}, formatMoney: value => String(value),
    getBillSlip: async () => ({ success: true, data: { mimeType: 'image/png', base64Data: 'AQ==',
      billNo: 'INV-1', totalAmount: 100, paymentStatus: 'PENDING', reviewVersion: options.oldBackend ? undefined : 'v' } }),
    reviewBillSlip: async (...args) => { calls.push(args); return { success: !options.fail, message: options.fail ? 'failed' : 'saved' }; }
  });
  vm.runInContext(script, c);
  await c.openBillSlip({ billId: 'b', billNo: 'INV-1' }, new Element('button'));
  return { elements, calls, messages, get: tag => elements.find(el => el.tag === tag),
    button: text => elements.find(el => el.tag === 'button' && el.textContent === text) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('pending slip has approve/reject buttons; rejection first asks for a reason', async () => {
  const f = await fixture();
  const reject = f.button('ปฏิเสธสลิป');
  assert.equal(reject.disabled, true);
  f.get('img').emit('load');
  assert.equal(reject.disabled, false);
  reject.emit('click');
  assert.equal(f.get('label').hidden, false);
  assert.equal(f.calls.length, 0);
  reject.emit('click');
  assert.equal(f.calls.length, 0);
  f.get('textarea').value = 'ยอดไม่ตรง';
  reject.emit('click');
  await settle();
  assert.deepEqual(f.calls[0], ['b', 'v', 'REJECTED', 'ยอดไม่ตรง']);
  assert.equal(f.get('dialog').open, false);
});
test('rapid approval clicks submit only once', async () => {
  const f = await fixture();
  f.get('img').emit('load');
  f.button('ยืนยันการชำระเงิน').emit('click');
  f.button('ยืนยันการชำระเงิน').emit('click');
  await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][2], 'APPROVED');
});
test('failed review stays open and shows error; close alone never reviews', async () => {
  const f = await fixture({ fail: true });
  f.get('img').emit('load');
  f.button('ยืนยันการชำระเงิน').emit('click');
  await settle();
  assert.equal(f.get('dialog').open, true);
  assert.equal(f.elements.find(el => el.className === 'page-message error').textContent, 'failed');
  f.button('ปิด').emit('click');
  assert.equal(f.calls.length, 1);
});
test('old backend gives an update message instead of silently hiding review buttons', async () => {
  const f = await fixture({ oldBackend: true });
  assert.equal(f.get('dialog'), undefined);
  assert.match(f.messages[0], /Apps Script/);
});
