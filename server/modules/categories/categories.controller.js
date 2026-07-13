const categoriesModel = require('./categories.model');

async function listCategories(req, res, next) {
  try {
    const data = await categoriesModel.listCategories(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getCategoryTree(req, res, next) {
  try {
    const data = await categoriesModel.getCategoryTree(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getCategory(req, res, next) {
  try {
    const data = await categoriesModel.loadCategoryById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const data = await categoriesModel.createCategory(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const data = await categoriesModel.updateCategory(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deactivateCategory(req, res, next) {
  try {
    const data = await categoriesModel.deactivateCategory(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  getCategoryTree,
  getCategory,
  createCategory,
  updateCategory,
  deactivateCategory,
};
