const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { productImageUpload, handleMulterError } = require('../../middleware/upload.middleware');
const {
  listBrandsQuerySchema,
  createBrandSchema,
  updateBrandSchema,
} = require('./brands.validation');
const brandsController = require('./brands.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('products.view'),
  validateQuery(listBrandsQuerySchema),
  brandsController.listBrands
);

router.get(
  '/:id',
  requirePermission('products.view'),
  brandsController.getBrand
);

router.post(
  '/',
  requirePermission('brands.manage'),
  validateBody(createBrandSchema),
  brandsController.createBrand
);

router.put(
  '/:id',
  requirePermission('brands.manage'),
  validateBody(updateBrandSchema),
  brandsController.updateBrand
);

router.delete(
  '/:id',
  requirePermission('brands.manage'),
  brandsController.deactivateBrand
);

router.post(
  '/:id/logo',
  requirePermission('brands.manage'),
  productImageUpload.single('logo'),
  handleMulterError,
  brandsController.uploadBrandLogo
);

router.delete(
  '/:id/logo',
  requirePermission('brands.manage'),
  brandsController.removeBrandLogo
);

module.exports = router;
