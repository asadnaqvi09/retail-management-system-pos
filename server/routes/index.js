const authRoutes = require('../modules/auth/auth.routes');
const productsRoutes = require('../modules/products/products.routes');
const categoriesRoutes = require('../modules/categories/categories.routes');
const brandsRoutes = require('../modules/brands/brands.routes');
const variantsRoutes = require('../modules/variants/variants.routes');
const inventoryRoutes = require('../modules/inventory/inventory.routes');
const salesRoutes = require('../modules/sales/sales.routes');
const cashRegisterRoutes = require('../modules/cash-register/cash-register.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const invoicesRoutes = require('../modules/invoices/invoices.routes');
const exchangesRoutes = require('../modules/exchanges/exchanges.routes');
const expensesRoutes = require('../modules/expenses/expenses.routes');
const expenseCategoriesRoutes = require('../modules/expenses/expense-categories.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const promotionsRoutes = require('../modules/promotions/promotions.routes');
const barcodesRoutes = require('../modules/barcodes/barcodes.routes');
const settingsRoutes = require('../modules/settings/settings.routes');
const backupRoutes = require('../modules/backup/backup.routes');
const whatsappRoutes = require('../modules/whatsapp/whatsapp.routes');

function registerRoutes(app) {
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/products', productsRoutes);
  app.use('/api/v1/categories', categoriesRoutes);
  app.use('/api/v1/brands', brandsRoutes);
  app.use('/api/v1/variants', variantsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/sales', salesRoutes);
  app.use('/api/v1/cash-register', cashRegisterRoutes);
  app.use('/api/v1/customers', customersRoutes);
  app.use('/api/v1/invoices', invoicesRoutes);
  app.use('/api/v1/exchanges', exchangesRoutes);
  app.use('/api/v1/expenses', expensesRoutes);
  app.use('/api/v1/expense-categories', expenseCategoriesRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/promotions', promotionsRoutes);
  app.use('/api/v1/labels', barcodesRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/backups', backupRoutes);
  app.use('/api/v1/whatsapp', whatsappRoutes);
}

module.exports = registerRoutes;
