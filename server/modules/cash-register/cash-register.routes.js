const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validate.middleware');
const { openSessionSchema, closeSessionSchema } = require('./cash-register.validation');
const cashRegisterController = require('./cash-register.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/current',
  requirePermission('cash_register.open_close'),
  cashRegisterController.getCurrentSession
);

router.post(
  '/open',
  requirePermission('cash_register.open_close'),
  validateBody(openSessionSchema),
  cashRegisterController.openSession
);

router.get(
  '/:id',
  requirePermission('cash_register.open_close'),
  cashRegisterController.getSession
);

router.post(
  '/:id/close',
  requirePermission('cash_register.open_close'),
  validateBody(closeSessionSchema),
  cashRegisterController.closeSession
);

module.exports = router;
