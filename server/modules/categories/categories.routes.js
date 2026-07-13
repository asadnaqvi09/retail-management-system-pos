const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  listCategoriesQuerySchema,
  treeQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./categories.validation');
const categoriesController = require('./categories.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('products.view'),
  validateQuery(listCategoriesQuerySchema),
  categoriesController.listCategories
);

router.get(
  '/tree',
  requirePermission('products.view'),
  validateQuery(treeQuerySchema),
  categoriesController.getCategoryTree
);

router.get(
  '/:id',
  requirePermission('products.view'),
  categoriesController.getCategory
);

router.post(
  '/',
  requirePermission('categories.manage'),
  validateBody(createCategorySchema),
  categoriesController.createCategory
);

router.put(
  '/:id',
  requirePermission('categories.manage'),
  validateBody(updateCategorySchema),
  categoriesController.updateCategory
);

router.delete(
  '/:id',
  requirePermission('categories.manage'),
  categoriesController.deactivateCategory
);

module.exports = router;
