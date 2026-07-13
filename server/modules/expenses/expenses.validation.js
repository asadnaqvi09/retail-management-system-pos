const Joi = require('joi');

const expensePaymentMethods = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer'];

const listExpensesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  categoryId: Joi.string().uuid(),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
  search: Joi.string().trim().allow('').default(''),
});

const monthlySummaryQuerySchema = Joi.object({
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
});

const createExpenseSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  expenseDate: Joi.string().isoDate().required(),
  paymentMethod: Joi.string().valid(...expensePaymentMethods).default('cash'),
  note: Joi.string().trim().allow('', null),
});

const updateExpenseSchema = Joi.object({
  categoryId: Joi.string().uuid(),
  amount: Joi.number().positive(),
  expenseDate: Joi.string().isoDate(),
  paymentMethod: Joi.string().valid(...expensePaymentMethods),
  note: Joi.string().trim().allow('', null),
}).min(1);

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  expensePaymentMethods,
  listExpensesQuerySchema,
  monthlySummaryQuerySchema,
  createExpenseSchema,
  updateExpenseSchema,
  createCategorySchema,
  updateCategorySchema,
};
