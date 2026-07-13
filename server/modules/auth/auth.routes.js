const express = require('express');
const { validateBody } = require('../../middleware/validate.middleware');
const { authenticate, requireRole } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimit.middleware');
const { loginSchema, forgotPasswordSchema, unlockSessionSchema } = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/session', authenticate, authController.getSession);
router.post(
  '/unlock',
  authLimiter,
  authenticate,
  validateBody(unlockSessionSchema),
  authController.unlockSession
);
router.post(
  '/forgot-password',
  authLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.get('/admin-only', authenticate, requireRole('Admin'), authController.adminOnly);

module.exports = router;
