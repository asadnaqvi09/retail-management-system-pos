const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  lookupVariantSchema,
  createSaleSchema,
  previewSaleSchema,
  createHoldCartSchema,
  listSalesQuerySchema,
} = require('./sales.validation');
const salesController = require('./sales.controller');

const router = express.Router();

router.use(authenticate);

router.post(
  '/lookup-variant',
  requirePermission('sales.create'),
  validateBody(lookupVariantSchema),
  salesController.lookupVariant
);

router.post(
  '/preview',
  requirePermission('sales.create'),
  validateBody(previewSaleSchema),
  salesController.previewSale
);

router.get(
  '/hold-carts',
  requirePermission('sales.hold_cart'),
  salesController.listHoldCarts
);

router.post(
  '/hold-carts',
  requirePermission('sales.hold_cart'),
  validateBody(createHoldCartSchema),
  salesController.createHoldCart
);

router.post(
  '/hold-carts/:id/resume',
  requirePermission('sales.hold_cart'),
  salesController.resumeHoldCart
);

router.delete(
  '/hold-carts/:id',
  requirePermission('sales.hold_cart'),
  salesController.cancelHoldCart
);

router.get(
  '/',
  requirePermission('sales.view'),
  validateQuery(listSalesQuerySchema),
  salesController.listSales
);

router.post(
  '/',
  requirePermission('sales.create'),
  validateBody(createSaleSchema),
  salesController.createSale
);

router.get(
  '/:id',
  requirePermission('sales.view'),
  salesController.getSale
);

router.post(
  '/:id/void',
  requirePermission('sales.void'),
  salesController.voidSale
);

module.exports = router;
