const Joi = require('joi');

const settingSections = [
  'business',
  'receipt',
  'currency',
  'tax',
  'language',
  'printer',
  'backup',
  'barcode',
  'shortcuts',
  'system',
  'whatsapp',
];

const receiptFormats = ['thermal', 'a4'];
const labelTemplates = ['40x30', '50x25', 'a4_sheet'];
const landingScreens = ['dashboard', 'pos'];
const userStatuses = ['active', 'inactive'];
const languages = ['en', 'ur-Roman'];
const receiptPaperWidths = ['58mm', '80mm'];

const updateSectionSchema = Joi.object({
  values: Joi.object().min(1).required(),
});

const updateStoreSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  email: Joi.string().trim().email().allow('', null),
  website: Joi.string().trim().max(255).allow('', null),
  address: Joi.string().trim().max(500).allow('', null),
  city: Joi.string().trim().max(120).allow('', null),
  country: Joi.string().trim().max(120),
  phone: Joi.string().trim().max(40).allow('', null),
  taxId: Joi.string().trim().max(80).allow('', null),
  businessDayStartTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/),
  currencyCode: Joi.string().trim().length(3),
  currencySymbol: Joi.string().trim().max(8),
  timezone: Joi.string().trim().max(80),
  defaultLanguage: Joi.string().valid(...languages),
  returnPolicyDays: Joi.number().integer().min(0).max(365),
  allowOversell: Joi.boolean(),
}).min(1);

const receiptSectionSchema = Joi.object({
  headerText: Joi.string().trim().max(500).allow(''),
  footerText: Joi.string().trim().max(500).allow(''),
  thankYouMessage: Joi.string().trim().max(255).allow(''),
  returnPolicyText: Joi.string().trim().max(500).allow(''),
  defaultFormat: Joi.string().valid(...receiptFormats),
  autoPrint: Joi.boolean(),
  showBarcode: Joi.boolean(),
  showQr: Joi.boolean(),
});

const taxSectionSchema = Joi.object({
  pricesIncludeTax: Joi.boolean(),
  showTaxOnReceipt: Joi.boolean(),
  displayTaxBreakdown: Joi.boolean(),
});

const languageSectionSchema = Joi.object({
  defaultLanguage: Joi.string().valid(...languages),
  dateFormat: Joi.string().trim().max(40),
  timeFormat: Joi.string().valid('12h', '24h'),
});

const printerSectionSchema = Joi.object({
  invoicePrinter: Joi.string().trim().max(120).allow(''),
  labelPrinter: Joi.string().trim().max(120).allow(''),
  receiptPaperWidth: Joi.string().valid(...receiptPaperWidths),
  silentPrint: Joi.boolean(),
});

const barcodeSectionSchema = Joi.object({
  defaultTemplate: Joi.string().valid(...labelTemplates),
  showPrice: Joi.boolean(),
  showProductName: Joi.boolean(),
  showSku: Joi.boolean(),
  defaultCopies: Joi.number().integer().min(1).max(100),
});

const backupSectionSchema = Joi.object({
  autoBackupEnabled: Joi.boolean(),
  backupTime: Joi.string().pattern(/^\d{2}:\d{2}$/),
  retentionDays: Joi.number().integer().min(1).max(365),
});

const whatsappSectionSchema = Joi.object({
  enabled: Joi.boolean(),
  phoneNumber: Joi.string().trim().max(30).allow(''),
  sendTime: Joi.string().pattern(/^\d{2}:\d{2}$/),
  includeLowStock: Joi.boolean(),
  includeTopProducts: Joi.boolean(),
  ownerName: Joi.string().trim().max(120).allow(''),
});

const createTaxClassSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  rate: Joi.number().min(0).max(100).required(),
  isDefault: Joi.boolean().default(false),
});

const updateTaxClassSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  rate: Joi.number().min(0).max(100),
  isDefault: Joi.boolean(),
  isActive: Joi.boolean(),
}).min(1);

const shortcutItemSchema = Joi.object({
  actionKey: Joi.string().trim().min(1).max(80).required(),
  shortcutKeys: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().trim().max(255).allow('', null),
  isActive: Joi.boolean(),
});

const updateShortcutsSchema = Joi.object({
  shortcuts: Joi.array().items(shortcutItemSchema).min(1).required(),
});

const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  status: Joi.string().valid(...userStatuses),
});

const createUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  username: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().email().allow('', null),
  roleId: Joi.string().uuid().required(),
  password: Joi.string().min(6).max(128),
  pin: Joi.string().pattern(/^\d{4,6}$/),
  defaultLandingScreen: Joi.string().valid(...landingScreens).default('dashboard'),
  status: Joi.string().valid(...userStatuses).default('active'),
}).custom((value, helpers) => {
  if (!value.password && !value.pin) {
    return helpers.error('any.invalid', { message: 'Password or PIN is required' });
  }
  if (value.password && value.pin) {
    return helpers.error('any.invalid', { message: 'Provide either password or PIN, not both' });
  }
  return value;
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  email: Joi.string().trim().email().allow('', null),
  roleId: Joi.string().uuid(),
  password: Joi.string().min(6).max(128).allow(null),
  pin: Joi.string().pattern(/^\d{4,6}$/).allow(null),
  defaultLandingScreen: Joi.string().valid(...landingScreens),
  status: Joi.string().valid(...userStatuses),
}).min(1);

module.exports = {
  settingSections,
  updateSectionSchema,
  updateStoreSchema,
  receiptSectionSchema,
  taxSectionSchema,
  languageSectionSchema,
  printerSectionSchema,
  barcodeSectionSchema,
  backupSectionSchema,
  whatsappSectionSchema,
  createTaxClassSchema,
  updateTaxClassSchema,
  updateShortcutsSchema,
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
};
