const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  exchangePayloadSchema,
  lookupSaleQuerySchema,
  listExchangesQuerySchema,
} = require('./exchanges.validation');
const exchangesController = require('./exchanges.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/lookup-sale',
  requirePermission('exchanges.manage'),
  validateQuery(lookupSaleQuerySchema),
  exchangesController.lookupSale
);

router.get(
  '/sales/:saleId/eligible',
  requirePermission('exchanges.manage'),
  exchangesController.getEligibleSale
);

router.post(
  '/preview',
  requirePermission('exchanges.manage'),
  validateBody(exchangePayloadSchema),
  exchangesController.previewExchange
);

router.get(
  '/',
  requirePermission('exchanges.manage'),
  validateQuery(listExchangesQuerySchema),
  exchangesController.listExchanges
);

router.post(
  '/',
  requirePermission('exchanges.manage'),
  validateBody(exchangePayloadSchema),
  exchangesController.createExchange
);

router.get(
  '/:id',
  requirePermission('exchanges.manage'),
  exchangesController.getExchange
);

module.exports = router;
