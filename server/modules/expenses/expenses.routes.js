const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { receiptUpload, handleMulterError } = require('../../middleware/upload.middleware');
const {
  listExpensesQuerySchema,
  monthlySummaryQuerySchema,
  createExpenseSchema,
  updateExpenseSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./expenses.validation');
const expensesController = require('./expenses.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/summary/monthly',
  requirePermission('expenses.view'),
  validateQuery(monthlySummaryQuerySchema),
  expensesController.getMonthlySummary
);

router.get(
  '/',
  requirePermission('expenses.view'),
  validateQuery(listExpensesQuerySchema),
  expensesController.listExpenses
);

router.post(
  '/',
  requirePermission('expenses.manage'),
  validateBody(createExpenseSchema),
  expensesController.createExpense
);

router.get(
  '/:id',
  requirePermission('expenses.view'),
  expensesController.getExpense
);

router.patch(
  '/:id',
  requirePermission('expenses.manage'),
  validateBody(updateExpenseSchema),
  expensesController.updateExpense
);

router.delete(
  '/:id',
  requirePermission('expenses.manage'),
  expensesController.deleteExpense
);

router.post(
  '/:id/receipt',
  requirePermission('expenses.manage'),
  receiptUpload.single('receipt'),
  handleMulterError,
  expensesController.uploadReceipt
);

module.exports = router;
