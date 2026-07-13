const brandsModel = require('./brands.model');

async function listBrands(req, res, next) {
  try {
    const data = await brandsModel.listBrands(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getBrand(req, res, next) {
  try {
    const data = await brandsModel.loadBrandById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createBrand(req, res, next) {
  try {
    const data = await brandsModel.createBrand(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateBrand(req, res, next) {
  try {
    const data = await brandsModel.updateBrand(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deactivateBrand(req, res, next) {
  try {
    const data = await brandsModel.deactivateBrand(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function uploadBrandLogo(req, res, next) {
  try {
    const data = await brandsModel.uploadBrandLogo(req.params.id, req.user.storeId, req.file);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function removeBrandLogo(req, res, next) {
  try {
    const data = await brandsModel.removeBrandLogo(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBrands,
  getBrand,
  createBrand,
  updateBrand,
  deactivateBrand,
  uploadBrandLogo,
  removeBrandLogo,
};
