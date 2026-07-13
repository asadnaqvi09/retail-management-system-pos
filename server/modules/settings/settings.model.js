const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { uploadImageBuffer, removeCloudinaryImage } = require('../../utils/cloudinaryUpload');

const DEFAULT_SECTION_VALUES = {
  receipt: {
    headerText: '',
    footerText: '',
    thankYouMessage: 'Thank you for shopping with us!',
    returnPolicyText: '',
    defaultFormat: 'thermal',
    autoPrint: true,
    showBarcode: true,
    showQr: true,
  },
  tax: {
    pricesIncludeTax: false,
    showTaxOnReceipt: true,
    displayTaxBreakdown: true,
  },
  currency: {
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
  language: {
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12h',
  },
  printer: {
    invoicePrinter: '',
    labelPrinter: '',
    receiptPaperWidth: '80mm',
    silentPrint: false,
  },
  barcode: {
    defaultTemplate: '40x30',
    showPrice: true,
    showProductName: true,
    showSku: true,
    defaultCopies: 1,
  },
  backup: {
    autoBackupEnabled: false,
    backupTime: '23:00',
    retentionDays: 30,
  },
  system: {
    sessionTimeoutMinutes: 480,
  },
  whatsapp: {
    enabled: false,
    phoneNumber: '',
    sendTime: '21:00',
    includeLowStock: true,
    includeTopProducts: true,
    ownerName: '',
  },
};

const {
  settingSections,
} = require('./settings.validation');
const SECTION_SCHEMAS = {
  receipt: require('./settings.validation').receiptSectionSchema,
  tax: require('./settings.validation').taxSectionSchema,
  language: require('./settings.validation').languageSectionSchema,
  printer: require('./settings.validation').printerSectionSchema,
  barcode: require('./settings.validation').barcodeSectionSchema,
  backup: require('./settings.validation').backupSectionSchema,
  whatsapp: require('./settings.validation').whatsappSectionSchema,
};

function assertValidSection(section) {
  if (!settingSections.includes(section)) {
    throw new AppError('Invalid settings section', 400);
  }
}

function throwWriteError(error) {
  if (error.code === '23505') {
    throw new AppError('A record with this value already exists', 409);
  }
  if (error.code === '23503') {
    throw new AppError('Invalid reference', 400);
  }
  throw error;
}

function mergeSectionValues(section, values) {
  const defaults = DEFAULT_SECTION_VALUES[section] || {};
  const current = values && typeof values === 'object' ? values : {};
  return { ...defaults, ...current };
}

function mapStoreRow(row) {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_path || null,
    email: row.email || null,
    website: row.website || null,
    address: row.address || null,
    city: row.city || null,
    country: row.country || 'Pakistan',
    phone: row.phone || null,
    taxId: row.tax_id || null,
    businessDayStartTime: row.business_day_start_time,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    timezone: row.timezone,
    defaultLanguage: row.default_language,
    returnPolicyDays: Number(row.return_policy_days || 7),
    allowOversell: Boolean(row.allow_oversell),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaxClassRow(row) {
  return {
    id: row.id,
    name: row.name,
    rate: Number(row.rate),
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapShortcutRow(row) {
  return {
    id: row.id,
    actionKey: row.action_key,
    shortcutKeys: row.shortcut_keys,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email || null,
    roleId: row.role_id,
    roleName: row.role_name,
    status: row.status,
    defaultLandingScreen: row.default_landing_screen,
    lastLoginAt: row.last_login_at,
    hasPassword: Boolean(row.password_hash),
    hasPin: Boolean(row.pin_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoleRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    isSystem: Boolean(row.is_system),
  };
}

async function loadStoreRecord(storeId) {
  const result = await query(
    `SELECT *
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Store not found', 404);
  }
  return result.rows[0];
}

async function loadSectionValues(storeId, section) {
  const result = await query(
    `SELECT values
     FROM store_settings
     WHERE store_id = $1 AND section = $2
     LIMIT 1`,
    [storeId, section]
  );
  return mergeSectionValues(section, result.rows[0]?.values || {});
}

async function getSettingsOverview(storeId) {
  const [store, sectionsResult, taxClasses, shortcuts] = await Promise.all([
    loadStoreRecord(storeId),
    query(
      `SELECT section, values
       FROM store_settings
       WHERE store_id = $1
       ORDER BY section`,
      [storeId]
    ),
    listTaxClasses(storeId),
    listShortcuts(storeId),
  ]);

  const sections = {};
  for (const row of sectionsResult.rows) {
    sections[row.section] = mergeSectionValues(row.section, row.values);
  }
  for (const key of Object.keys(DEFAULT_SECTION_VALUES)) {
    if (!sections[key]) {
      sections[key] = { ...DEFAULT_SECTION_VALUES[key] };
    }
  }
  sections.language = {
    ...sections.language,
    defaultLanguage: store.default_language,
  };
  sections.currency = {
    ...sections.currency,
    currencyCode: store.currency_code,
    currencySymbol: store.currency_symbol,
  };

  return {
    store: mapStoreRow(store),
    sections,
    taxClasses,
    shortcuts,
  };
}

async function getSection(storeId, section) {
  assertValidSection(section);
  if (section === 'business') {
    const store = await loadStoreRecord(storeId);
    return mapStoreRow(store);
  }
  const values = await loadSectionValues(storeId, section);
  if (section === 'language') {
    const store = await loadStoreRecord(storeId);
    values.defaultLanguage = store.default_language;
  }
  if (section === 'currency') {
    const store = await loadStoreRecord(storeId);
    values.currencyCode = store.currency_code;
    values.currencySymbol = store.currency_symbol;
  }
  return values;
}

async function updateSection(storeId, section, values) {
  assertValidSection(section);
  const schema = SECTION_SCHEMAS[section];
  if (!schema) {
    throw new AppError('This settings section cannot be updated directly', 400);
  }
  const { error, value } = schema.validate(values, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((item) => item.message).join(', '), 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (section === 'language' && value.defaultLanguage) {
      await client.query(
        `UPDATE stores
         SET default_language = $1, updated_at = NOW()
         WHERE id = $2`,
        [value.defaultLanguage, storeId]
      );
    }

    const existing = await client.query(
      `SELECT values
       FROM store_settings
       WHERE store_id = $1 AND section = $2
       FOR UPDATE`,
      [storeId, section]
    );
    const merged = {
      ...mergeSectionValues(section, existing.rows[0]?.values || {}),
      ...value,
    };
    if (existing.rows[0]) {
      await client.query(
        `UPDATE store_settings
         SET values = $1::jsonb, updated_at = NOW()
         WHERE store_id = $2 AND section = $3`,
        [JSON.stringify(merged), storeId, section]
      );
    } else {
      await client.query(
        `INSERT INTO store_settings (store_id, section, values)
         VALUES ($1, $2, $3::jsonb)`,
        [storeId, section, JSON.stringify(merged)]
      );
    }

    await client.query('COMMIT');
    return getSection(storeId, section);
  } catch (error) {
    await client.query('ROLLBACK');
    throwWriteError(error);
  } finally {
    client.release();
  }
}

async function updateStore(storeId, payload) {
  const fields = [];
  const values = [];
  let index = 1;

  const fieldMap = {
    name: 'name',
    email: 'email',
    website: 'website',
    address: 'address',
    city: 'city',
    country: 'country',
    phone: 'phone',
    taxId: 'tax_id',
    businessDayStartTime: 'business_day_start_time',
    currencyCode: 'currency_code',
    currencySymbol: 'currency_symbol',
    timezone: 'timezone',
    defaultLanguage: 'default_language',
    returnPolicyDays: 'return_policy_days',
    allowOversell: 'allow_oversell',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (payload[key] !== undefined) {
      fields.push(`${column} = $${index}`);
      values.push(payload[key]);
      index += 1;
    }
  }

  if (fields.length === 0) {
    throw new AppError('No store fields to update', 400);
  }

  values.push(storeId);
  const result = await query(
    `UPDATE stores
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${index}
     RETURNING *`,
    values
  );
  if (!result.rows[0]) {
    throw new AppError('Store not found', 404);
  }
  return mapStoreRow(result.rows[0]);
}

async function uploadStoreLogo(storeId, file) {
  const store = await loadStoreRecord(storeId);
  if (store.logo_path) {
    await removeCloudinaryImage(store.logo_path);
  }
  const logoId = uuidv4();
  const logoUrl = await uploadImageBuffer(file.buffer, {
    folder: 'zyro-rms/stores',
    publicId: logoId,
  });
  const result = await query(
    `UPDATE stores
     SET logo_path = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [logoUrl, storeId]
  );
  return mapStoreRow(result.rows[0]);
}

async function removeStoreLogo(storeId) {
  const store = await loadStoreRecord(storeId);
  if (!store.logo_path) {
    throw new AppError('Store logo not found', 404);
  }
  await removeCloudinaryImage(store.logo_path);
  const result = await query(
    `UPDATE stores
     SET logo_path = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [storeId]
  );
  return mapStoreRow(result.rows[0]);
}

async function listTaxClasses(storeId) {
  const result = await query(
    `SELECT *
     FROM tax_classes
     WHERE store_id = $1
     ORDER BY is_default DESC, name ASC`,
    [storeId]
  );
  return result.rows.map(mapTaxClassRow);
}

async function createTaxClass(storeId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    if (payload.isDefault) {
      await client.query(
        `UPDATE tax_classes
         SET is_default = FALSE, updated_at = NOW()
         WHERE store_id = $1`,
        [storeId]
      );
    }
    const result = await client.query(
      `INSERT INTO tax_classes (store_id, name, rate, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [storeId, payload.name, payload.rate, payload.isDefault || false]
    );
    await client.query('COMMIT');
    return mapTaxClassRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throwWriteError(error);
  } finally {
    client.release();
  }
}

async function updateTaxClass(storeId, taxClassId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id FROM tax_classes WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [taxClassId, storeId]
    );
    if (!existing.rows[0]) {
      throw new AppError('Tax class not found', 404);
    }
    if (payload.isDefault) {
      await client.query(
        `UPDATE tax_classes
         SET is_default = FALSE, updated_at = NOW()
         WHERE store_id = $1`,
        [storeId]
      );
    }
    const fields = [];
    const values = [];
    let index = 1;
    if (payload.name !== undefined) {
      fields.push(`name = $${index}`);
      values.push(payload.name);
      index += 1;
    }
    if (payload.rate !== undefined) {
      fields.push(`rate = $${index}`);
      values.push(payload.rate);
      index += 1;
    }
    if (payload.isDefault !== undefined) {
      fields.push(`is_default = $${index}`);
      values.push(payload.isDefault);
      index += 1;
    }
    if (payload.isActive !== undefined) {
      fields.push(`is_active = $${index}`);
      values.push(payload.isActive);
      index += 1;
    }
    if (fields.length === 0) {
      throw new AppError('No tax class fields to update', 400);
    }
    values.push(taxClassId, storeId);
    const result = await client.query(
      `UPDATE tax_classes
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND store_id = $${index + 1}
       RETURNING *`,
      values
    );
    await client.query('COMMIT');
    return mapTaxClassRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throwWriteError(error);
  } finally {
    client.release();
  }
}

async function deleteTaxClass(storeId, taxClassId) {
  const existing = await query(
    `SELECT id, is_default
     FROM tax_classes
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [taxClassId, storeId]
  );
  if (!existing.rows[0]) {
    throw new AppError('Tax class not found', 404);
  }
  const productUsage = await query(
    `SELECT COUNT(*)::INT AS count
     FROM products
     WHERE tax_class_id = $1`,
    [taxClassId]
  );
  if (Number(productUsage.rows[0].count) > 0) {
    const result = await query(
      `UPDATE tax_classes
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      [taxClassId, storeId]
    );
    return { ...mapTaxClassRow(result.rows[0]), deactivated: true };
  }
  await query(`DELETE FROM tax_classes WHERE id = $1 AND store_id = $2`, [taxClassId, storeId]);
  return { id: taxClassId, deleted: true };
}

async function listShortcuts(storeId) {
  const result = await query(
    `SELECT *
     FROM keyboard_shortcuts
     WHERE store_id = $1
     ORDER BY action_key ASC`,
    [storeId]
  );
  return result.rows.map(mapShortcutRow);
}

async function updateShortcuts(storeId, shortcuts) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const updated = [];
    for (const item of shortcuts) {
      const result = await client.query(
        `UPDATE keyboard_shortcuts
         SET shortcut_keys = $1,
             description = COALESCE($2, description),
             is_active = COALESCE($3, is_active),
             updated_at = NOW()
         WHERE store_id = $4 AND action_key = $5
         RETURNING *`,
        [
          item.shortcutKeys,
          item.description ?? null,
          item.isActive ?? null,
          storeId,
          item.actionKey,
        ]
      );
      if (!result.rows[0]) {
        const insertResult = await client.query(
          `INSERT INTO keyboard_shortcuts (store_id, action_key, shortcut_keys, description, is_active)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            storeId,
            item.actionKey,
            item.shortcutKeys,
            item.description || null,
            item.isActive ?? true,
          ]
        );
        updated.push(mapShortcutRow(insertResult.rows[0]));
      } else {
        updated.push(mapShortcutRow(result.rows[0]));
      }
    }
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throwWriteError(error);
  } finally {
    client.release();
  }
}

async function listRoles(storeId) {
  const result = await query(
    `SELECT id, name, description, is_system
     FROM roles
     WHERE store_id = $1
     ORDER BY name ASC`,
    [storeId]
  );
  return result.rows.map(mapRoleRow);
}

async function findUserRecord(userId, storeId) {
  const result = await query(
    `SELECT u.*, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.store_id = $2
     LIMIT 1`,
    [userId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('User not found', 404);
  }
  return result.rows[0];
}

async function listUsers(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      u.*,
      r.name AS role_name,
      COUNT(*) OVER() AS total_count
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.store_id = $1
       AND ($2::text IS NULL OR u.name ILIKE $2 OR u.username ILIKE $2 OR u.email ILIKE $2)
       AND ($3::text IS NULL OR u.status::text = $3)
     ORDER BY u.name ASC
     LIMIT $4 OFFSET $5`,
    [storeId, searchTerm, filters.status || null, limit, offset]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapUserRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function assertRoleInStore(roleId, storeId) {
  const result = await query(
    `SELECT id FROM roles WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [roleId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Invalid role', 400);
  }
}

async function createUser(storeId, payload) {
  await assertRoleInStore(payload.roleId, storeId);
  const passwordHash = payload.password ? await bcrypt.hash(payload.password, 10) : null;
  const pinHash = payload.pin ? await bcrypt.hash(payload.pin, 10) : null;
  try {
    const result = await query(
      `INSERT INTO users (
        store_id,
        role_id,
        name,
        username,
        email,
        password_hash,
        pin_hash,
        status,
        default_landing_screen
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        storeId,
        payload.roleId,
        payload.name,
        payload.username,
        payload.email || null,
        passwordHash,
        pinHash,
        payload.status || 'active',
        payload.defaultLandingScreen || 'dashboard',
      ]
    );
    return mapUserRow({
      ...result.rows[0],
      role_name: (
        await query(`SELECT name FROM roles WHERE id = $1`, [payload.roleId])
      ).rows[0].name,
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError('Username already exists', 409);
    }
    throwWriteError(error);
  }
}

async function updateUser(storeId, userId, payload, actorUserId) {
  const user = await findUserRecord(userId, storeId);
  if (payload.status === 'inactive' && userId === actorUserId) {
    throw new AppError('You cannot deactivate your own account', 400);
  }
  if (payload.roleId) {
    await assertRoleInStore(payload.roleId, storeId);
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (payload.name !== undefined) {
    fields.push(`name = $${index}`);
    values.push(payload.name);
    index += 1;
  }
  if (payload.email !== undefined) {
    fields.push(`email = $${index}`);
    values.push(payload.email || null);
    index += 1;
  }
  if (payload.roleId !== undefined) {
    fields.push(`role_id = $${index}`);
    values.push(payload.roleId);
    index += 1;
  }
  if (payload.status !== undefined) {
    fields.push(`status = $${index}`);
    values.push(payload.status);
    index += 1;
  }
  if (payload.defaultLandingScreen !== undefined) {
    fields.push(`default_landing_screen = $${index}`);
    values.push(payload.defaultLandingScreen);
    index += 1;
  }
  if (payload.password) {
    fields.push(`password_hash = $${index}`);
    values.push(await bcrypt.hash(payload.password, 10));
    index += 1;
    fields.push('pin_hash = NULL');
  } else if (payload.pin) {
    fields.push(`pin_hash = $${index}`);
    values.push(await bcrypt.hash(payload.pin, 10));
    index += 1;
    fields.push('password_hash = NULL');
  }

  if (fields.length === 0) {
    throw new AppError('No user fields to update', 400);
  }

  values.push(userId, storeId);
  try {
    const result = await query(
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND store_id = $${index + 1}
       RETURNING *`,
      values
    );
    const roleName = (
      await query(`SELECT name FROM roles WHERE id = $1`, [result.rows[0].role_id])
    ).rows[0].name;
    return mapUserRow({ ...result.rows[0], role_name: roleName });
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError('Username already exists', 409);
    }
    throwWriteError(error);
  }
}

module.exports = {
  getSettingsOverview,
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
