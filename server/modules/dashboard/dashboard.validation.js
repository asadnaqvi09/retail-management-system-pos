const Joi = require('joi');

const dashboardQuerySchema = Joi.object({
  activityLimit: Joi.number().integer().min(1).max(50).default(20),
  topProductsLimit: Joi.number().integer().min(1).max(20).default(5),
  lowStockLimit: Joi.number().integer().min(1).max(25).default(10),
  chartDays: Joi.number().integer().min(7).max(30).default(7),
});

module.exports = {
  dashboardQuerySchema,
};
