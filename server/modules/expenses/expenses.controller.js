const expensesModel = require('./expenses.model');

async function listExpenses(req, res, next) {
  try {
    const data = await expensesModel.listExpenses(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getExpense(req, res, next) {
  try {
    const data = await expensesModel.loadExpenseById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const data = await expensesModel.createExpense(req.user.storeId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateExpense(req, res, next) {
  try {
    const data = await expensesModel.updateExpense(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const data = await expensesModel.deleteExpense(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function uploadReceipt(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Receipt image is required' });
    }
    const data = await expensesModel.saveExpenseReceipt(req.params.id, req.user.storeId, req.file);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getMonthlySummary(req, res, next) {
  try {
    const data = await expensesModel.getMonthlySummary(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    const data = await expensesModel.listCategories(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const data = await expensesModel.createCategory(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const data = await expensesModel.updateCategory(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadReceipt,
  getMonthlySummary,
  listCategories,
  createCategory,
  updateCategory,
};
