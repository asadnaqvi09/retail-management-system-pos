const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateQuery } = require('../../middleware/validate.middleware');
const { dashboardQuerySchema } = require('./dashboard.validation');
const dashboardController = require('./dashboard.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('dashboard.view'),
  validateQuery(dashboardQuerySchema),
  dashboardController.getDashboardOverview
);

module.exports = router;
