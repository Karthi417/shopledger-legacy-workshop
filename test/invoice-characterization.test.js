const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function riceItem(price, quantity) {
  return {
    id: 1,
    name: 'Rice',
    sku: 'RICE-001',
    hsn: '1006',
    price,
    qty: quantity
  };
}

test('invoice and ledger use the HSN GST slab', () => {
  const items = [riceItem(100, 1)];

  const ledger = pricing.computeTotals(items, '');
  const printedInvoice = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.deepEqual(
    {
      subtotal: ledger.subtotal,
      tax: ledger.tax,
      total: ledger.total,
      gstPercent: ledger.lines[0].gstPercent
    },
    { subtotal: 100, tax: 5, total: 105, gstPercent: 5 }
  );
  assert.deepEqual(
    {
      subtotal: printedInvoice.subtotal,
      tax: printedInvoice.tax,
      total: printedInvoice.total,
      gstPercent: printedInvoice.rows[0].gstPercent
    },
    { subtotal: 100, tax: 5, total: 105, gstPercent: 5 }
  );
});

test('invoice applies the coupon using the ledger pricing basis', () => {
  const items = [riceItem(1000, 1)];

  const ledger = pricing.computeTotals(items, 'SAVE10');
  const printedInvoice = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { discount: 100, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { discount: printedInvoice.discount, tax: printedInvoice.tax, total: printedInvoice.total },
    { discount: 100, tax: 45, total: 945 }
  );
});

test('GST reconciliation reports no delta when invoice matches the ledger', () => {
  const items = [riceItem(100, 1)];
  const db = {
    orders: [{
      id: 1001,
      date: '2026-11-22',
      customer: 'Walk-in',
      items,
      coupon: '',
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105,
      status: 'completed'
    }]
  };

  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(
    {
      ledgerTax: reconciliation.rows[0].ledgerTax,
      invoiceTax: reconciliation.rows[0].invoiceTax,
      invoiceTotal: reconciliation.rows[0].invoiceTotal,
      delta: reconciliation.rows[0].delta,
      matched: reconciliation.rows[0].matched
    },
    { ledgerTax: 5, invoiceTax: 5, invoiceTotal: 105, delta: 0, matched: true }
  );
});
