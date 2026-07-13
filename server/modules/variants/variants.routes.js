const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validate.middleware');
const { generateMatrixSchema, updateVariantSchema } = require('./variants.validation');
const variantsController = require('./variants.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/attributes',
  requirePermission('products.view'),
  variantsController.getAttributeMatrix
);

router.get(
  '/product/:productId',
  requirePermission('products.view'),
  variantsController.listProductVariants
);

router.post(
  '/product/:productId/generate',
  requirePermission('variants.manage'),
  validateBody(generateMatrixSchema),
  variantsController.generateVariantMatrix
);

router.put(
  '/:id',
  requirePermission('variants.manage'),
  validateBody(updateVariantSchema),
  variantsController.updateVariant
);

router.delete(
  '/:id',
  requirePermission('variants.manage'),
  variantsController.deactivateVariant
);

module.exports = router;
