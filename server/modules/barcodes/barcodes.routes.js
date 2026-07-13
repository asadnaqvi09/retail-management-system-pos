const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { labelQuerySchema, bulkLabelsSchema } = require('./barcodes.validation');
const barcodesController = require('./barcodes.controller');

const router = express.Router();

router.use(authenticate);

router.post(
  '/bulk',
  requirePermission('barcodes.print'),
  validateBody(bulkLabelsSchema),
  barcodesController.downloadBulkLabelsPdf
);

router.get(
  '/:variantId/pdf',
  requirePermission('barcodes.print'),
  validateQuery(labelQuerySchema),
  barcodesController.downloadVariantLabelPdf
);

router.get(
  '/:variantId',
  requirePermission('barcodes.print'),
  barcodesController.getVariantLabel
);

module.exports = router;
