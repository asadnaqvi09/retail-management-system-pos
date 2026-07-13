const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  productImageUpload,
  importFileUpload,
  handleMulterError,
} = require('../../middleware/upload.middleware');
const {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  exportProductsQuerySchema,
} = require('./products.validation');
const productsController = require('./products.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('products.view'),
  validateQuery(listProductsQuerySchema),
  productsController.listProducts
);

router.get(
  '/export',
  requirePermission('products.view'),
  validateQuery(exportProductsQuerySchema),
  productsController.exportProducts
);

router.get(
  '/:id',
  requirePermission('products.view'),
  productsController.getProduct
);

router.post(
  '/',
  requirePermission('products.create'),
  validateBody(createProductSchema),
  productsController.createProduct
);

router.post(
  '/import',
  requirePermission('products.create'),
  importFileUpload.single('file'),
  handleMulterError,
  productsController.importProducts
);

router.put(
  '/:id',
  requirePermission('products.update'),
  validateBody(updateProductSchema),
  productsController.updateProduct
);

router.delete(
  '/:id',
  requirePermission('products.delete'),
  productsController.archiveProduct
);

router.post(
  '/:id/images',
  requirePermission('products.update'),
  productImageUpload.array('images', 10),
  handleMulterError,
  productsController.uploadProductImages
);

router.delete(
  '/:id/images/:imageId',
  requirePermission('products.update'),
  productsController.removeProductImage
);

router.patch(
  '/:id/images/:imageId/primary',
  requirePermission('products.update'),
  productsController.markPrimaryProductImage
);

module.exports = router;
