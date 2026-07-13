const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  listCustomersQuerySchema,
  createCustomerSchema,
  updateCustomerSchema,
} = require('./customers.validation');
const customersController = require('./customers.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('customers.view'),
  validateQuery(listCustomersQuerySchema),
  customersController.listCustomers
);

router.get(
  '/:id',
  requirePermission('customers.view'),
  customersController.getCustomer
);

router.post(
  '/',
  requirePermission('customers.manage'),
  validateBody(createCustomerSchema),
  customersController.createCustomer
);

router.put(
  '/:id',
  requirePermission('customers.manage'),
  validateBody(updateCustomerSchema),
  customersController.updateCustomer
);

router.delete(
  '/:id',
  requirePermission('customers.manage'),
  customersController.deactivateCustomer
);

module.exports = router;
