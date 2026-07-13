const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { productImageUpload, handleMulterError } = require('../../middleware/upload.middleware');
const {
  updateSectionSchema,
  updateStoreSchema,
  createTaxClassSchema,
  updateTaxClassSchema,
  updateShortcutsSchema,
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
} = require('./settings.validation');
const settingsController = require('./settings.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('settings.view'),
  settingsController.getSettings
);

router.patch(
  '/store',
  requirePermission('settings.manage'),
  validateBody(updateStoreSchema),
  settingsController.updateStore
);

router.post(
  '/store/logo',
  requirePermission('settings.manage'),
  productImageUpload.single('logo'),
  handleMulterError,
  settingsController.uploadStoreLogo
);

router.delete(
  '/store/logo',
  requirePermission('settings.manage'),
  settingsController.removeStoreLogo
);

router.get(
  '/tax-classes',
  requirePermission('settings.view'),
  settingsController.listTaxClasses
);

router.post(
  '/tax-classes',
  requirePermission('settings.manage'),
  validateBody(createTaxClassSchema),
  settingsController.createTaxClass
);

router.patch(
  '/tax-classes/:id',
  requirePermission('settings.manage'),
  validateBody(updateTaxClassSchema),
  settingsController.updateTaxClass
);

router.delete(
  '/tax-classes/:id',
  requirePermission('settings.manage'),
  settingsController.deleteTaxClass
);

router.get(
  '/shortcuts',
  requirePermission('settings.view', 'sales.create'),
  settingsController.listShortcuts
);

router.patch(
  '/shortcuts',
  requirePermission('settings.manage'),
  validateBody(updateShortcutsSchema),
  settingsController.updateShortcuts
);

router.get(
  '/roles',
  requirePermission('settings.view'),
  settingsController.listRoles
);

router.get(
  '/users',
  requirePermission('settings.view'),
  validateQuery(listUsersQuerySchema),
  settingsController.listUsers
);

router.post(
  '/users',
  requirePermission('auth.manage_users'),
  validateBody(createUserSchema),
  settingsController.createUser
);

router.patch(
  '/users/:id',
  requirePermission('auth.manage_users'),
  validateBody(updateUserSchema),
  settingsController.updateUser
);

router.get(
  '/sections/:section',
  requirePermission('settings.view'),
  settingsController.getSection
);

router.patch(
  '/sections/:section',
  requirePermission('settings.manage'),
  validateBody(updateSectionSchema),
  settingsController.updateSection
);

module.exports = router;
