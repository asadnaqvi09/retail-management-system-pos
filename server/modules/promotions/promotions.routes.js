const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  listPromotionsQuerySchema,
  createPromotionSchema,
  updatePromotionSchema,
} = require('./promotions.validation');
const promotionsController = require('./promotions.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('promotions.manage'),
  validateQuery(listPromotionsQuerySchema),
  promotionsController.listPromotions
);

router.post(
  '/',
  requirePermission('promotions.manage'),
  validateBody(createPromotionSchema),
  promotionsController.createPromotion
);

router.get(
  '/:id',
  requirePermission('promotions.manage'),
  promotionsController.getPromotion
);

router.patch(
  '/:id',
  requirePermission('promotions.manage'),
  validateBody(updatePromotionSchema),
  promotionsController.updatePromotion
);

router.delete(
  '/:id',
  requirePermission('promotions.manage'),
  promotionsController.deletePromotion
);

module.exports = router;
