const settingsModel = require('./settings.model');

async function getSettings(req, res, next) {
  try {
    const data = await settingsModel.getSettingsOverview(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getSection(req, res, next) {
  try {
    const data = await settingsModel.getSection(req.user.storeId, req.params.section);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateSection(req, res, next) {
  try {
    const data = await settingsModel.updateSection(
      req.user.storeId,
      req.params.section,
      req.body.values
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateStore(req, res, next) {
  try {
    const data = await settingsModel.updateStore(req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function uploadStoreLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Logo image is required' });
    }
    const data = await settingsModel.uploadStoreLogo(req.user.storeId, req.file);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function removeStoreLogo(req, res, next) {
  try {
    const data = await settingsModel.removeStoreLogo(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listTaxClasses(req, res, next) {
  try {
    const data = await settingsModel.listTaxClasses(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createTaxClass(req, res, next) {
  try {
    const data = await settingsModel.createTaxClass(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateTaxClass(req, res, next) {
  try {
    const data = await settingsModel.updateTaxClass(
      req.user.storeId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deleteTaxClass(req, res, next) {
  try {
    const data = await settingsModel.deleteTaxClass(req.user.storeId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listShortcuts(req, res, next) {
  try {
    const data = await settingsModel.listShortcuts(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateShortcuts(req, res, next) {
  try {
    const data = await settingsModel.updateShortcuts(req.user.storeId, req.body.shortcuts);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listRoles(req, res, next) {
  try {
    const data = await settingsModel.listRoles(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await settingsModel.listUsers(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const data = await settingsModel.createUser(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const data = await settingsModel.updateUser(
      req.user.storeId,
      req.params.id,
      req.body,
      req.user.id
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSettings,
  getSection,
  updateSection,
  updateStore,
  uploadStoreLogo,
  removeStoreLogo,
  listTaxClasses,
  createTaxClass,
  updateTaxClass,
  deleteTaxClass,
  listShortcuts,
  updateShortcuts,
  listRoles,
  listUsers,
  createUser,
  updateUser,
};
