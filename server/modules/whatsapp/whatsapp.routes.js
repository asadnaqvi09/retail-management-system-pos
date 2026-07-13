const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const {
  listSummariesQuerySchema,
  previewQuerySchema,
  sendSummarySchema,
  testMessageSchema,
} = require('./whatsapp.validation');
const whatsappController = require('./whatsapp.controller');

const router = express.Router();

router.use(authenticate);
router.use(requirePermission('whatsapp.manage'));

router.get(
  '/summaries',
  validateQuery(listSummariesQuerySchema),
  whatsappController.listSummaries
);

router.get(
  '/preview',
  validateQuery(previewQuerySchema),
  whatsappController.previewSummary
);

router.post(
  '/send',
  validateBody(sendSummarySchema),
  whatsappController.sendSummary
);

router.post(
  '/test',
  validateBody(testMessageSchema),
  whatsappController.sendTestMessage
);

router.get('/summaries/:id', whatsappController.getSummary);

module.exports = router;
