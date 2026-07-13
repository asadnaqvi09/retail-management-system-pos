const Joi = require('joi');

const promotionTypes = ['percentage', 'fixed'];
const promotionScopes = ['product', 'category', 'brand', 'store_wide'];
const precedenceRules = ['highest_discount', 'most_specific'];
const promotionStatuses = ['active', 'scheduled', 'expired'];

const listPromotionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  status: Joi.string().valid(...promotionStatuses),
});

const createPromotionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  promotionType: Joi.string().valid(...promotionTypes).required(),
  discountValue: Joi.number().min(0).required(),
  scopeType: Joi.string().valid(...promotionScopes).required(),
  scopeId: Joi.string().uuid().allow(null),
  couponCode: Joi.string().trim().max(50).allow('', null),
  startAt: Joi.date().iso().required(),
  endAt: Joi.date().iso().greater(Joi.ref('startAt')).required(),
  precedenceRule: Joi.string().valid(...precedenceRules).default('most_specific'),
}).custom((value, helpers) => {
  if (value.scopeType === 'store_wide' && value.scopeId) {
    return helpers.error('any.invalid', { message: 'Store-wide promotions cannot have a scope target' });
  }
  if (value.scopeType !== 'store_wide' && !value.scopeId) {
    return helpers.error('any.invalid', { message: 'Scope target is required for this promotion scope' });
  }
  if (value.promotionType === 'percentage' && value.discountValue > 100) {
    return helpers.error('any.invalid', { message: 'Percentage discount cannot exceed 100' });
  }
  return value;
});

const updatePromotionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  promotionType: Joi.string().valid(...promotionTypes),
  discountValue: Joi.number().min(0),
  scopeType: Joi.string().valid(...promotionScopes),
  scopeId: Joi.string().uuid().allow(null),
  couponCode: Joi.string().trim().max(50).allow('', null),
  startAt: Joi.date().iso(),
  endAt: Joi.date().iso(),
  precedenceRule: Joi.string().valid(...precedenceRules),
})
  .min(1)
  .custom((value, helpers) => {
    if (value.startAt && value.endAt && value.endAt <= value.startAt) {
      return helpers.error('any.invalid', { message: 'End date must be after start date' });
    }
    if (value.promotionType === 'percentage' && value.discountValue > 100) {
      return helpers.error('any.invalid', { message: 'Percentage discount cannot exceed 100' });
    }
    return value;
  });

module.exports = {
  promotionTypes,
  promotionScopes,
  precedenceRules,
  promotionStatuses,
  listPromotionsQuerySchema,
  createPromotionSchema,
  updatePromotionSchema,
};
