const productsModel = require('./products.model');

async function listProducts(req, res, next) {
  try {
    const data = await productsModel.listProducts(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const data = await productsModel.loadProductById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const data = await productsModel.createProduct(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const data = await productsModel.updateProduct(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function archiveProduct(req, res, next) {
  try {
    const data = await productsModel.archiveProduct(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function uploadProductImages(req, res, next) {
  try {
    const data = await productsModel.uploadProductImages(
      req.params.id,
      req.user.storeId,
      req.files
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function removeProductImage(req, res, next) {
  try {
    const data = await productsModel.removeProductImage(
      req.params.id,
      req.params.imageId,
      req.user.storeId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function markPrimaryProductImage(req, res, next) {
  try {
    const data = await productsModel.markPrimaryProductImage(
      req.params.id,
      req.params.imageId,
      req.user.storeId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function importProducts(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Import file is required' });
    }
    const data = await productsModel.importProducts(req.user.storeId, req.file);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function exportProducts(req, res, next) {
  try {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const exportFile = await productsModel.exportProducts(req.user.storeId, req.query, format);
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.send(exportFile.buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  uploadProductImages,
  removeProductImage,
  markPrimaryProductImage,
  importProducts,
  exportProducts,
};
