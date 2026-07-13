const express = require('express');
const { validateBody } = require('../../middleware/validate.middleware');
const { authenticate, requireRole } = require('../../middleware/auth.middleware');
const { loginSchema, forgotPasswordSchema, unlockSessionSchema } = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/login', validateBody(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/session', authenticate, authController.getSession);
router.post(
  '/unlock',
  authenticate,
  validateBody(unlockSessionSchema),
  authController.unlockSession
);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.get('/admin-only', authenticate, requireRole('Admin'), authController.adminOnly);

module.exports = router;
