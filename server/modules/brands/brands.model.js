const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { uploadImageBuffer, removeCloudinaryImage } = require('../../utils/cloudinaryUpload');

function throwWriteError(error) {
  if (error.code === '23505') {
    throw new AppError('A brand with this name already exists', 409);
  }
  if (error.code === '23503') {
    throw new AppError('Invalid brand reference', 400);
  }
  throw error;
}

function mapBrandRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    logoUrl: row.logo_path || null,
    isActive: row.is_active,
    productCount: Number(row.product_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function brandSelectColumns() {
  return `
    b.*,
    COALESCE(pc.product_count, 0) AS product_count
  `;
}

function brandJoins() {
  return `
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS product_count
      FROM products
      WHERE brand_id = b.id
    ) pc ON TRUE
  `;
}

async function findBrandRecord(brandId, storeId) {
  const result = await query(
    `SELECT id, store_id, name, logo_path, is_active
     FROM brands
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [brandId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Brand not found', 404);
  }
  return result.rows[0];
}

async function loadBrandById(brandId, storeId) {
  const result = await query(
    `SELECT ${brandSelectColumns()}
     FROM brands b
     ${brandJoins()}
     WHERE b.id = $1 AND b.store_id = $2
     LIMIT 1`,
    [brandId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Brand not found', 404);
  }
  return mapBrandRow(result.rows[0]);
}

async function listBrands(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      ${brandSelectColumns()},
      COUNT(*) OVER() AS total_count
     FROM brands b
     ${brandJoins()}
     WHERE b.store_id = $1
       AND ($2::text IS NULL OR b.name ILIKE $2)
       AND ($3::boolean IS NULL OR b.is_active = $3)
     ORDER BY b.name ASC
     LIMIT $4 OFFSET $5`,
    [storeId, searchTerm, filters.isActive ?? null, limit, offset]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapBrandRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function createBrand(storeId, payload) {
  try {
    const result = await query(
      `INSERT INTO brands (store_id, name, is_active)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [storeId, payload.name, payload.isActive ?? true]
    );
    return loadBrandById(result.rows[0].id, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function updateBrand(brandId, storeId, payload) {
  await findBrandRecord(brandId, storeId);
  const fieldMap = {
    name: 'name',
    isActive: 'is_active',
  };
  const fields = [];
  const values = [];
  let index = 1;
  Object.entries(fieldMap).forEach(([payloadKey, columnName]) => {
    if (payload[payloadKey] !== undefined) {
      fields.push(`${columnName} = $${index}`);
      values.push(payload[payloadKey]);
      index += 1;
    }
  });
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(brandId, storeId);
  try {
    await query(
      `UPDATE brands
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND store_id = $${index + 1}`,
      values
    );
    return loadBrandById(brandId, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function deactivateBrand(brandId, storeId) {
  await findBrandRecord(brandId, storeId);
  await query(
    `UPDATE brands
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND store_id = $2`,
    [brandId, storeId]
  );
  return loadBrandById(brandId, storeId);
}

async function uploadBrandLogo(brandId, storeId, file) {
  if (!file) {
    throw new AppError('Logo image is required', 400);
  }
  const brand = await findBrandRecord(brandId, storeId);
  if (brand.logo_path) {
    await removeCloudinaryImage(brand.logo_path);
  }
  const logoId = uuidv4();
  const uploadResult = await uploadImageBuffer(file.buffer, {
    folder: `zyro-rms/${storeId}/brands/${brandId}`,
    publicId: logoId,
  });
  await query(
    `UPDATE brands
     SET logo_path = $1, updated_at = NOW()
     WHERE id = $2 AND store_id = $3`,
    [uploadResult.secure_url, brandId, storeId]
  );
  return loadBrandById(brandId, storeId);
}

async function removeBrandLogo(brandId, storeId) {
  const brand = await findBrandRecord(brandId, storeId);
  if (!brand.logo_path) {
    throw new AppError('Brand logo not found', 404);
  }
  await removeCloudinaryImage(brand.logo_path);
  await query(
    `UPDATE brands
     SET logo_path = NULL, updated_at = NOW()
     WHERE id = $1 AND store_id = $2`,
    [brandId, storeId]
  );
  return loadBrandById(brandId, storeId);
}

module.exports = {
  listBrands,
  loadBrandById,
  createBrand,
  updateBrand,
  deactivateBrand,
  uploadBrandLogo,
  removeBrandLogo,
};
