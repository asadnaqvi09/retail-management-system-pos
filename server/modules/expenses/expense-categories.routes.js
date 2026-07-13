const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validate.middleware');
const { createCategorySchema, updateCategorySchema } = require('./expenses.validation');
const expensesController = require('./expenses.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('expenses.view'),
  expensesController.listCategories
);

router.post(
  '/',
  requirePermission('expenses.manage'),
  validateBody(createCategorySchema),
  expensesController.createCategory
);

router.patch(
  '/:id',
  requirePermission('expenses.manage'),
  validateBody(updateCategorySchema),
  expensesController.updateCategory
);

module.exports = router;
