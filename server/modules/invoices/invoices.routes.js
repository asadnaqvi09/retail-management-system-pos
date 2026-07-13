const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { invoiceQuerySchema, createPrintLogSchema } = require('./invoices.validation');
const invoicesController = require('./invoices.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/:saleId',
  requirePermission('invoices.print'),
  invoicesController.getInvoicePayload
);

router.get(
  '/:saleId/pdf',
  requirePermission('invoices.print'),
  validateQuery(invoiceQuerySchema),
  invoicesController.downloadInvoicePdf
);

router.get(
  '/:saleId/print-logs',
  requirePermission('invoices.print'),
  invoicesController.listPrintLogs
);

router.post(
  '/:saleId/print-logs',
  requirePermission('invoices.print'),
  validateBody(createPrintLogSchema),
  invoicesController.createPrintLog
);

module.exports = router;
