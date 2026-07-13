const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  adjustStockSchema,
  updateThresholdSchema,
} = require('./inventory.validation');
const inventoryController = require('./inventory.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('inventory.view'),
  validateQuery(listInventoryQuerySchema),
  inventoryController.listInventory
);

router.get(
  '/movements',
  requirePermission('inventory.view'),
  validateQuery(listMovementsQuerySchema),
  inventoryController.listStockMovements
);

router.get(
  '/:variantId/movements',
  requirePermission('inventory.view'),
  validateQuery(listMovementsQuerySchema),
  inventoryController.listVariantMovements
);

router.get(
  '/:variantId',
  requirePermission('inventory.view'),
  inventoryController.getInventoryItem
);

router.post(
  '/:variantId/adjust',
  requirePermission('inventory.adjust'),
  validateBody(adjustStockSchema),
  inventoryController.adjustStock
);

router.put(
  '/:variantId/threshold',
  requirePermission('inventory.adjust'),
  validateBody(updateThresholdSchema),
  inventoryController.updateReorderThreshold
);

module.exports = router;
