const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { uploadImageBuffer, removeCloudinaryImage } = require('../../utils/cloudinaryUpload');

function throwWriteError(error) {
  if (error.code === '23505') {
    throw new AppError('A product with this SKU already exists', 409);
  }
  if (error.code === '23503') {
    throw new AppError('Invalid category, brand, or tax class reference', 400);
  }
  throw error;
}

function mapProductRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description,
    baseSku: row.base_sku,
    defaultSellingPrice: Number(row.default_selling_price),
    defaultCostPrice: Number(row.default_cost_price),
    status: row.status,
    attributesJson: row.attributes_json || {},
    category: row.category_id
      ? { id: row.category_id, name: row.category_name }
      : null,
    brand: row.brand_id
      ? { id: row.brand_id, name: row.brand_name }
      : null,
    taxClass: row.tax_class_id
      ? {
          id: row.tax_class_id,
          name: row.tax_class_name,
          rate: row.tax_class_rate != null ? Number(row.tax_class_rate) : null,
        }
      : null,
    primaryImage: row.primary_image_id
      ? { id: row.primary_image_id, url: row.primary_image_url }
      : null,
    imageCount: Number(row.image_count || 0),
    variantCount: Number(row.variant_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImageRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    url: row.file_path,
    isPrimary: row.is_primary,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

async function ensureCategoryBelongsToStore(categoryId, storeId) {
  if (!categoryId) {
    return;
  }
  const result = await query(
    `SELECT id FROM categories WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [categoryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Category not found', 404);
  }
}

async function ensureBrandBelongsToStore(brandId, storeId) {
  if (!brandId) {
    return;
  }
  const result = await query(
    `SELECT id FROM brands WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [brandId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Brand not found', 404);
  }
}

async function ensureTaxClassBelongsToStore(taxClassId, storeId) {
  if (!taxClassId) {
    return;
  }
  const result = await query(
    `SELECT id FROM tax_classes WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [taxClassId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Tax class not found', 404);
  }
}

async function findProductRecord(productId, storeId) {
  const result = await query(
    `SELECT id, store_id, name, base_sku, status
     FROM products
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [productId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Product not found', 404);
  }
  return result.rows[0];
}

async function loadProductById(productId, storeId) {
  const result = await query(
    `SELECT
      p.*,
      c.name AS category_name,
      b.name AS brand_name,
      t.name AS tax_class_name,
      t.rate AS tax_class_rate,
      pi.id AS primary_image_id,
      pi.file_path AS primary_image_url,
      COALESCE(img.image_count, 0) AS image_count,
      COALESCE(v.variant_count, 0) AS variant_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN tax_classes t ON t.id = p.tax_class_id
    LEFT JOIN LATERAL (
      SELECT id, file_path
      FROM product_images
      WHERE product_id = p.id
      ORDER BY is_primary DESC, display_order ASC, created_at ASC
      LIMIT 1
    ) pi ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS image_count
      FROM product_images
      WHERE product_id = p.id
    ) img ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS variant_count
      FROM variants
      WHERE product_id = p.id
    ) v ON TRUE
    WHERE p.id = $1 AND p.store_id = $2
    LIMIT 1`,
    [productId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Product not found', 404);
  }
  const imagesResult = await query(
    `SELECT id, product_id, variant_id, file_path, is_primary, display_order, created_at
     FROM product_images
     WHERE product_id = $1
     ORDER BY is_primary DESC, display_order ASC, created_at ASC`,
    [productId]
  );
  const product = mapProductRow(result.rows[0]);
  product.images = imagesResult.rows.map(mapImageRow);
  return product;
}

async function listProducts(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const searchTerm = filters.search ? `%${filters.search}%` : null;
  const result = await query(
    `SELECT
      p.*,
      c.name AS category_name,
      b.name AS brand_name,
      t.name AS tax_class_name,
      t.rate AS tax_class_rate,
      pi.id AS primary_image_id,
      pi.file_path AS primary_image_url,
      COALESCE(img.image_count, 0) AS image_count,
      COALESCE(v.variant_count, 0) AS variant_count,
      COUNT(*) OVER() AS total_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN tax_classes t ON t.id = p.tax_class_id
    LEFT JOIN LATERAL (
      SELECT id, file_path
      FROM product_images
      WHERE product_id = p.id
      ORDER BY is_primary DESC, display_order ASC, created_at ASC
      LIMIT 1
    ) pi ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS image_count
      FROM product_images
      WHERE product_id = p.id
    ) img ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS variant_count
      FROM variants
      WHERE product_id = p.id
    ) v ON TRUE
    WHERE p.store_id = $1
      AND ($2::text IS NULL OR p.name ILIKE $2 OR p.base_sku ILIKE $2)
      AND ($3::product_status IS NULL OR p.status = $3)
      AND ($4::uuid IS NULL OR p.category_id = $4)
      AND ($5::uuid IS NULL OR p.brand_id = $5)
    ORDER BY p.updated_at DESC, p.created_at DESC
    LIMIT $6 OFFSET $7`,
    [
      storeId,
      searchTerm,
      filters.status || null,
      filters.categoryId || null,
      filters.brandId || null,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapProductRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function createProduct(storeId, payload) {
  await ensureCategoryBelongsToStore(payload.categoryId, storeId);
  await ensureBrandBelongsToStore(payload.brandId, storeId);
  await ensureTaxClassBelongsToStore(payload.taxClassId, storeId);
  try {
    const result = await query(
      `INSERT INTO products (
        store_id,
        category_id,
        brand_id,
        tax_class_id,
        name,
        description,
        base_sku,
        default_selling_price,
        default_cost_price,
        status,
        attributes_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        storeId,
        payload.categoryId || null,
        payload.brandId || null,
        payload.taxClassId || null,
        payload.name,
        payload.description || null,
        payload.baseSku,
        payload.defaultSellingPrice,
        payload.defaultCostPrice,
        payload.status,
        JSON.stringify(payload.attributesJson || {}),
      ]
    );
    return loadProductById(result.rows[0].id, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function updateProduct(productId, storeId, payload) {
  await findProductRecord(productId, storeId);
  if (payload.categoryId !== undefined) {
    await ensureCategoryBelongsToStore(payload.categoryId, storeId);
  }
  if (payload.brandId !== undefined) {
    await ensureBrandBelongsToStore(payload.brandId, storeId);
  }
  if (payload.taxClassId !== undefined) {
    await ensureTaxClassBelongsToStore(payload.taxClassId, storeId);
  }
  const fields = [];
  const values = [];
  let index = 1;
  const fieldMap = {
    name: 'name',
    description: 'description',
    baseSku: 'base_sku',
    defaultSellingPrice: 'default_selling_price',
    defaultCostPrice: 'default_cost_price',
    status: 'status',
    categoryId: 'category_id',
    brandId: 'brand_id',
    taxClassId: 'tax_class_id',
  };
  Object.entries(fieldMap).forEach(([key, column]) => {
    if (payload[key] !== undefined) {
      fields.push(`${column} = $${index}`);
      values.push(payload[key]);
      index += 1;
    }
  });
  if (payload.attributesJson !== undefined) {
    fields.push(`attributes_json = $${index}`);
    values.push(JSON.stringify(payload.attributesJson));
    index += 1;
  }
  if (fields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }
  values.push(productId, storeId);
  try {
    await query(
      `UPDATE products
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND store_id = $${index + 1}`,
      values
    );
    return loadProductById(productId, storeId);
  } catch (error) {
    throwWriteError(error);
  }
}

async function archiveProduct(productId, storeId) {
  await findProductRecord(productId, storeId);
  await query(
    `UPDATE products
     SET status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND store_id = $2`,
    [productId, storeId]
  );
  return { message: 'Product archived successfully' };
}

async function uploadProductImages(productId, storeId, files) {
  if (!files || files.length === 0) {
    throw new AppError('At least one image is required', 400);
  }
  await findProductRecord(productId, storeId);
  const existingImages = await query(
    `SELECT COUNT(*)::INT AS count FROM product_images WHERE product_id = $1`,
    [productId]
  );
  const hasPrimary = await query(
    `SELECT EXISTS(
      SELECT 1 FROM product_images WHERE product_id = $1 AND is_primary = TRUE
    ) AS has_primary`,
    [productId]
  );
  let displayOrder = existingImages.rows[0].count;
  let shouldSetPrimary = !hasPrimary.rows[0].has_primary;
  const uploadedImages = [];
  for (const file of files) {
    const imageId = uuidv4();
    const uploadResult = await uploadImageBuffer(file.buffer, {
      folder: `zyro-rms/${storeId}/products/${productId}`,
      publicId: imageId,
    });
    const insertResult = await query(
      `INSERT INTO product_images (
        id,
        product_id,
        file_path,
        is_primary,
        display_order
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, product_id, variant_id, file_path, is_primary, display_order, created_at`,
      [imageId, productId, uploadResult.secure_url, shouldSetPrimary, displayOrder]
    );
    uploadedImages.push(mapImageRow(insertResult.rows[0]));
    displayOrder += 1;
    shouldSetPrimary = false;
  }
  await query(`UPDATE products SET updated_at = NOW() WHERE id = $1`, [productId]);
  return uploadedImages;
}

async function removeProductImage(productId, imageId, storeId) {
  await findProductRecord(productId, storeId);
  const imageResult = await query(
    `SELECT id, file_path, is_primary
     FROM product_images
     WHERE id = $1 AND product_id = $2
     LIMIT 1`,
    [imageId, productId]
  );
  if (!imageResult.rows[0]) {
    throw new AppError('Product image not found', 404);
  }
  const image = imageResult.rows[0];
  await removeCloudinaryImage(image.file_path);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM product_images WHERE id = $1`, [imageId]);
    if (image.is_primary) {
      await client.query(
        `UPDATE product_images
         SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM product_images
           WHERE product_id = $1
           ORDER BY display_order ASC, created_at ASC
           LIMIT 1
         )`,
        [productId]
      );
    }
    await client.query(`UPDATE products SET updated_at = NOW() WHERE id = $1`, [productId]);
    await client.query('COMMIT');
    return { message: 'Product image removed successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markPrimaryProductImage(productId, imageId, storeId) {
  await findProductRecord(productId, storeId);
  const imageResult = await query(
    `SELECT id FROM product_images WHERE id = $1 AND product_id = $2 LIMIT 1`,
    [imageId, productId]
  );
  if (!imageResult.rows[0]) {
    throw new AppError('Product image not found', 404);
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE product_images SET is_primary = FALSE WHERE product_id = $1`,
      [productId]
    );
    await client.query(
      `UPDATE product_images SET is_primary = TRUE WHERE id = $1`,
      [imageId]
    );
    await client.query(`UPDATE products SET updated_at = NOW() WHERE id = $1`, [productId]);
    await client.query('COMMIT');
    return loadProductById(productId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function normalizeImportRow(row) {
  return {
    name: String(row.name || row.Name || '').trim(),
    baseSku: String(row.base_sku || row.baseSku || row.BaseSku || row.sku || '').trim().toUpperCase(),
    description: String(row.description || row.Description || '').trim(),
    defaultSellingPrice: Number(row.default_selling_price ?? row.defaultSellingPrice ?? row.selling_price ?? 0),
    defaultCostPrice: Number(row.default_cost_price ?? row.defaultCostPrice ?? row.cost_price ?? 0),
    status: String(row.status || row.Status || 'active').trim().toLowerCase(),
    categoryId: row.category_id || row.categoryId || null,
    brandId: row.brand_id || row.brandId || null,
  };
}

async function parseImportBuffer(file) {
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  if (extension === 'csv') {
    const rows = parse(file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return rows.map(normalizeImportRow);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError('Import file has no worksheet', 400);
  }
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => String(value || '').trim());
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row.getCell(index + 1).value;
    });
    rows.push(normalizeImportRow(record));
  });
  return rows;
}

async function importProducts(storeId, file) {
  const rows = await parseImportBuffer(file);
  if (rows.length === 0) {
    throw new AppError('Import file has no product rows', 400);
  }
  const summary = {
    totalRows: rows.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    if (!row.name || !row.baseSku) {
      summary.failed += 1;
      summary.errors.push({ row: rowNumber, message: 'Name and base SKU are required' });
      continue;
    }
    if (!['active', 'inactive', 'draft'].includes(row.status)) {
      summary.failed += 1;
      summary.errors.push({ row: rowNumber, message: 'Invalid status value' });
      continue;
    }
    try {
      const existing = await query(
        `SELECT id FROM products WHERE store_id = $1 AND base_sku = $2 LIMIT 1`,
        [storeId, row.baseSku]
      );
      if (existing.rows[0]) {
        summary.skipped += 1;
        continue;
      }
      await createProduct(storeId, {
        name: row.name,
        description: row.description || null,
        baseSku: row.baseSku,
        defaultSellingPrice: Number.isFinite(row.defaultSellingPrice) ? row.defaultSellingPrice : 0,
        defaultCostPrice: Number.isFinite(row.defaultCostPrice) ? row.defaultCostPrice : 0,
        status: row.status,
        categoryId: row.categoryId || null,
        brandId: row.brandId || null,
        taxClassId: null,
        attributesJson: {},
      });
      summary.created += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        row: rowNumber,
        message: error.message || 'Failed to import row',
      });
    }
  }
  return summary;
}

async function exportProducts(storeId, filters, format) {
  const result = await query(
    `SELECT
      p.name,
      p.base_sku,
      p.description,
      p.default_selling_price,
      p.default_cost_price,
      p.status,
      c.name AS category_name,
      b.name AS brand_name,
      pi.file_path AS primary_image_url
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN LATERAL (
      SELECT file_path
      FROM product_images
      WHERE product_id = p.id
      ORDER BY is_primary DESC, display_order ASC, created_at ASC
      LIMIT 1
    ) pi ON TRUE
    WHERE p.store_id = $1
      AND ($2::product_status IS NULL OR p.status = $2)
      AND ($3::uuid IS NULL OR p.category_id = $3)
      AND ($4::uuid IS NULL OR p.brand_id = $4)
    ORDER BY p.name ASC`,
    [storeId, filters.status || null, filters.categoryId || null, filters.brandId || null]
  );
  const rows = result.rows.map((row) => ({
    name: row.name,
    base_sku: row.base_sku,
    description: row.description || '',
    default_selling_price: Number(row.default_selling_price),
    default_cost_price: Number(row.default_cost_price),
    status: row.status,
    category_name: row.category_name || '',
    brand_name: row.brand_name || '',
    primary_image_url: row.primary_image_url || '',
  }));
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');
    worksheet.columns = [
      { header: 'name', key: 'name', width: 30 },
      { header: 'base_sku', key: 'base_sku', width: 20 },
      { header: 'description', key: 'description', width: 40 },
      { header: 'default_selling_price', key: 'default_selling_price', width: 18 },
      { header: 'default_cost_price', key: 'default_cost_price', width: 18 },
      { header: 'status', key: 'status', width: 12 },
      { header: 'category_name', key: 'category_name', width: 20 },
      { header: 'brand_name', key: 'brand_name', width: 20 },
      { header: 'primary_image_url', key: 'primary_image_url', width: 40 },
    ];
    worksheet.addRows(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: `products-${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }
  const csv = stringify(rows, { header: true });
  return {
    filename: `products-${Date.now()}.csv`,
    contentType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  };
}

module.exports = {
  listProducts,
  loadProductById,
  createProduct,
  updateProduct,
  archiveProduct,
  uploadProductImages,
  removeProductImage,
  markPrimaryProductImage,
  importProducts,
  exportProducts,
};
