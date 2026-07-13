const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const salesModel = require('../sales/sales.model');
const { buildInvoicePdf } = require('./invoices.pdf');

const DEFAULT_RECEIPT_SETTINGS = {
  headerText: '',
  footerText: '',
  thankYouMessage: 'Thank you for shopping with us!',
  returnPolicyText: 'Returns accepted within 7 days with original receipt.',
  defaultFormat: 'thermal',
  autoPrint: true,
};

function mapStoreRow(row) {
  return {
    id: row.id,
    name: row.name,
    logoPath: row.logo_path || null,
    email: row.email || null,
    website: row.website || null,
    address: row.address || null,
    city: row.city || null,
    country: row.country || null,
    phone: row.phone || null,
    taxId: row.tax_id || null,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    returnPolicyDays: Number(row.return_policy_days || 7),
    timezone: row.timezone,
  };
}

function mergeReceiptSettings(store, receiptValues) {
  const values = receiptValues && typeof receiptValues === 'object' ? receiptValues : {};
  const returnPolicyText =
    values.returnPolicyText ||
    `Returns accepted within ${store.returnPolicyDays} days with original receipt.`;
  return {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...values,
    returnPolicyText: values.returnPolicyText || returnPolicyText,
  };
}

async function fetchStoreContext(storeId) {
  const storeResult = await query(
    `SELECT
      id,
      name,
      logo_path,
      email,
      website,
      address,
      city,
      country,
      phone,
      tax_id,
      currency_code,
      currency_symbol,
      return_policy_days,
      timezone
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );
  if (!storeResult.rows[0]) {
    throw new AppError('Store not found', 404);
  }
  const receiptResult = await query(
    `SELECT values
     FROM store_settings
     WHERE store_id = $1 AND section = 'receipt'
     LIMIT 1`,
    [storeId]
  );
  const store = mapStoreRow(storeResult.rows[0]);
  const receipt = mergeReceiptSettings(
    store,
    receiptResult.rows[0]?.values || {}
  );
  return { store, receipt };
}

async function assertSaleAccessible(saleId, storeId) {
  const saleResult = await query(
    `SELECT id, status
     FROM sales
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [saleId, storeId]
  );
  if (!saleResult.rows[0]) {
    throw new AppError('Sale not found', 404);
  }
  if (saleResult.rows[0].status === 'voided') {
    throw new AppError('Cannot print invoice for a voided sale', 400);
  }
  return saleResult.rows[0];
}

async function buildInvoicePayload(storeId, saleId) {
  await assertSaleAccessible(saleId, storeId);
  const [{ store, receipt }, sale] = await Promise.all([
    fetchStoreContext(storeId),
    salesModel.getSaleById(saleId, storeId),
  ]);
  return {
    store,
    receipt,
    sale,
    formatOptions: ['thermal', 'a4'],
    defaultFormat: receipt.defaultFormat || 'thermal',
  };
}

async function generateInvoicePdf(storeId, saleId, format = 'thermal') {
  const payload = await buildInvoicePayload(storeId, saleId);
  const pdfBuffer = await buildInvoicePdf(payload, format);
  return {
    buffer: pdfBuffer,
    filename: `${payload.sale.invoiceNumber}-${format}.pdf`,
    contentType: 'application/pdf',
    format,
    saleId,
    invoiceNumber: payload.sale.invoiceNumber,
  };
}

async function createPrintLog(saleId, storeId, format, status = 'queued', errorMessage = null) {
  await assertSaleAccessible(saleId, storeId);
  const result = await query(
    `INSERT INTO invoice_print_logs (sale_id, format, status, error_message, printed_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'printed' THEN NOW() ELSE NULL END)
     RETURNING id, sale_id, format, status, error_message, printed_at, created_at`,
    [saleId, format, status, errorMessage]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    saleId: row.sale_id,
    format: row.format,
    status: row.status,
    errorMessage: row.error_message,
    printedAt: row.printed_at,
    createdAt: row.created_at,
  };
}

async function listPrintLogs(saleId, storeId) {
  await assertSaleAccessible(saleId, storeId);
  const result = await query(
    `SELECT
      ipl.id,
      ipl.sale_id,
      ipl.format,
      ipl.status,
      ipl.error_message,
      ipl.printed_at,
      ipl.created_at
     FROM invoice_print_logs ipl
     JOIN sales s ON s.id = ipl.sale_id
     WHERE ipl.sale_id = $1 AND s.store_id = $2
     ORDER BY ipl.created_at DESC`,
    [saleId, storeId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    saleId: row.sale_id,
    format: row.format,
    status: row.status,
    errorMessage: row.error_message,
    printedAt: row.printed_at,
    createdAt: row.created_at,
  }));
}

module.exports = {
  buildInvoicePayload,
  generateInvoicePdf,
  createPrintLog,
  listPrintLogs,
  assertSaleAccessible,
};
