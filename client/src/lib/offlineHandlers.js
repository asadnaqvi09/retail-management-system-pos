import {
  electronCacheGet,
  electronCacheQuery,
  electronCacheSet,
  electronCancelHoldCartLocal,
  electronCreateHoldCartLocal,
  electronCreateLocalSale,
  electronGetLocalInvoicePdf,
  electronListHoldCartsLocal,
  electronQueueWrite,
  electronResumeHoldCartLocal,
  hasElectronBridge,
} from './electronBridge';
import {
  buildOfflineInvoiceNumber,
  computePreviewTotals,
  mergeSaleLines,
} from './offlineSale';

function success(data, meta) {
  return {
    data: {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
  };
}

function failure(message, status = 'OFFLINE') {
  return {
    error: {
      status,
      data: { success: false, error: message },
    },
  };
}

function parseArgs(args) {
  if (typeof args === 'string') {
    return { url: args, method: 'GET', params: undefined, body: undefined };
  }
  return {
    url: args.url,
    method: (args.method || 'GET').toUpperCase(),
    params: args.params,
    body: args.body,
  };
}

function normalizePath(url) {
  return String(url || '').split('?')[0].replace(/^\//, '');
}

function paginate(items, params = {}) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const slice = items.slice(offset, offset + limit);
  const total = items.length;
  return {
    items: slice,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

function mapInventoryItem(variant) {
  return {
    variantId: variant.variantId,
    sku: variant.sku,
    barcode: variant.barcode,
    variantStatus: variant.status || 'active',
    product: {
      id: variant.product?.id,
      name: variant.product?.name,
      baseSku: variant.sku,
      categoryName: null,
      brandName: null,
    },
    attributes: variant.attributes || [],
    quantityOnHand: variant.stock?.quantityOnHand ?? 0,
    reorderThreshold: 0,
    isLowStock: false,
    updatedAt: variant.updatedAt || null,
  };
}

async function getVariantsList() {
  const rows = await electronCacheQuery('variants_cache', {});
  return Array.isArray(rows) ? rows : [];
}

async function getCustomersList(search) {
  const rows = await electronCacheQuery('customers_cache', search ? { search } : {});
  return Array.isArray(rows) ? rows : [];
}

async function buildSettingsOverview() {
  const rows = await electronCacheQuery('settings_cache', {});
  const sections = {};
  let store = {};
  let taxClasses = [];
  let shortcuts = [];
  let cashRegisterCurrent = null;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row.section === 'store') {
      store = row.payload || {};
      return;
    }
    if (row.section === 'tax_classes') {
      taxClasses = row.payload || [];
      return;
    }
    if (row.section === 'shortcuts_list') {
      shortcuts = row.payload || [];
      return;
    }
    if (row.section === 'cash_register_current') {
      cashRegisterCurrent = row.payload || null;
      return;
    }
    sections[row.section] = row.payload || {};
  });
  return { store, sections, taxClasses, shortcuts, cashRegisterCurrent };
}

async function handleLookupVariant(body) {
  const variant = await electronCacheQuery('variants_cache', { code: body?.code });
  if (!variant) {
    return failure('No product found for this barcode or SKU', 404);
  }
  return success(variant);
}

async function handlePreviewSale(body) {
  const mergedLines = mergeSaleLines(body?.lines || []);
  const variantMap = new Map();
  for (const line of mergedLines) {
    const variant = await electronCacheGet('variants_cache', line.variantId);
    if (!variant) {
      return failure('One or more variants were not found in local cache', 404);
    }
    variantMap.set(line.variantId, variant);
  }
  return success(computePreviewTotals(mergedLines, variantMap));
}

async function handleCreateSale(body) {
  const clientRequestId = crypto.randomUUID();
  const preview = await handlePreviewSale({ lines: body?.lines || [] });
  if (preview.error) {
    return preview;
  }
  const totals = preview.data.data;
  const invoiceNumber = buildOfflineInvoiceNumber();
  const localSaleId = clientRequestId;
  const linesForInvoice = [];
  await electronQueueWrite('sale', 'create', {
    ...body,
    clientRequestId,
    offlineInvoiceNumber: invoiceNumber,
  });
  for (const line of body?.lines || []) {
    const variant = await electronCacheGet('variants_cache', line.variantId);
    if (!variant) {
      continue;
    }
    linesForInvoice.push({
      variantId: line.variantId,
      sku: variant.sku,
      productName: variant.product?.name || '',
      quantity: line.quantity,
      unitPrice: variant.unitPrice ?? variant.sellingPrice ?? 0,
      lineTotal: Number(variant.unitPrice ?? variant.sellingPrice ?? 0) * Number(line.quantity || 0),
    });
    const nextStock = Math.max(
      0,
      Number(variant.stock?.quantityOnHand ?? 0) - Number(line.quantity || 0)
    );
    await electronCacheSet('variants_cache', line.variantId, {
      ...variant,
      stock: { quantityOnHand: nextStock },
    });
  }
  await electronCreateLocalSale({
    id: localSaleId,
    clientRequestId,
    invoiceNumber,
    totals,
    createdAt: new Date().toISOString(),
    body,
    linesForInvoice,
  });
  return success({
    id: localSaleId,
    invoiceNumber,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    status: 'completed',
    offline: true,
    clientRequestId,
  });
}

async function handleCreateHoldCart(body) {
  const clientRequestId = crypto.randomUUID();
  const preview = await handlePreviewSale({ lines: body?.lines || [] });
  if (preview.error) {
    return preview;
  }
  const totals = preview.data.data;
  const holdCartId = clientRequestId;
  const payload = {
    id: holdCartId,
    label: body?.label || null,
    customerId: body?.customerId || null,
    note: body?.note || null,
    lines: body?.lines || [],
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
  };
  await electronQueueWrite('hold_cart', 'create', {
    ...body,
    clientRequestId,
  });
  const local = await electronCreateHoldCartLocal(payload);
  return success({ ...local, lineCount: payload.lines.length, offline: true });
}

async function handleOfflineWrite(parsed) {
  const path = normalizePath(parsed.url);
  const method = parsed.method;
  if (method === 'POST' && path === 'sales/lookup-variant') {
    return handleLookupVariant(parsed.body);
  }
  if (method === 'POST' && path === 'sales/preview') {
    return handlePreviewSale(parsed.body);
  }
  if (method === 'POST' && path === 'sales') {
    return handleCreateSale(parsed.body);
  }
  if (method === 'POST' && path === 'sales/hold-carts') {
    return handleCreateHoldCart(parsed.body);
  }
  if (method === 'DELETE' && path.startsWith('sales/hold-carts/')) {
    const holdCartId = path.split('/')[2];
    await electronQueueWrite('hold_cart', 'delete', { holdCartId, id: holdCartId });
    await electronCancelHoldCartLocal(holdCartId);
    return success({ id: holdCartId, status: 'cancelled', offline: true });
  }
  if (method === 'POST' && path === 'cash-register/open') {
    const clientRequestId = crypto.randomUUID();
    await electronQueueWrite('cash_register', 'create', {
      ...parsed.body,
      clientRequestId,
    });
    await electronCacheSet('settings_cache', 'cash_register_current', {
      payload: {
        id: clientRequestId,
        status: 'open',
        openingAmount: parsed.body?.openingAmount ?? 0,
        user: parsed.body?.userId ? { id: parsed.body.userId } : null,
        offline: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return success({
      id: clientRequestId,
      status: 'open',
      openingAmount: parsed.body?.openingAmount ?? 0,
      offline: true,
    });
  }
  const closeMatch = path.match(/^cash-register\/([^/]+)\/close$/);
  if (method === 'POST' && closeMatch) {
    const sessionId = closeMatch[1];
    await electronQueueWrite('cash_register', 'update', {
      sessionId,
      body: parsed.body,
    });
    await electronCacheSet('settings_cache', 'cash_register_current', {
      payload: {
        id: sessionId,
        status: 'closed',
        offline: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return success({
      id: sessionId,
      status: 'closed',
      offline: true,
    });
  }
  return failure('This action is not available offline');
}

function base64ToBlob(base64, contentType = 'application/pdf') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

async function handleOfflineRead(parsed) {
  const path = normalizePath(parsed.url);
  const method = parsed.method;
  if (method === 'POST' && path === 'sales/lookup-variant') {
    return handleLookupVariant(parsed.body);
  }
  if (method === 'POST' && path === 'sales/preview') {
    return handlePreviewSale(parsed.body);
  }
  if (method === 'GET' && path === 'inventory') {
    const variants = await getVariantsList();
    const items = variants.map(mapInventoryItem);
    const paged = paginate(items, parsed.params);
    return success(paged.items, paged.meta);
  }
  const inventoryItemMatch = path.match(/^inventory\/([^/]+)$/);
  if (method === 'GET' && inventoryItemMatch && inventoryItemMatch[1] !== 'movements') {
    const variant = await electronCacheGet('variants_cache', inventoryItemMatch[1]);
    if (!variant) {
      return failure('Inventory item not found in local cache', 404);
    }
    return success(mapInventoryItem(variant));
  }
  if (method === 'GET' && path === 'customers') {
    const customers = await getCustomersList(parsed.params?.search);
    const paged = paginate(customers, parsed.params);
    return success(paged.items, paged.meta);
  }
  const customerMatch = path.match(/^customers\/([^/]+)$/);
  if (method === 'GET' && customerMatch) {
    const customer = await electronCacheGet('customers_cache', customerMatch[1]);
    if (!customer) {
      return failure('Customer not found in local cache', 404);
    }
    return success(customer);
  }
  if (method === 'GET' && path === 'settings') {
    return success(await buildSettingsOverview());
  }
  if (method === 'GET' && path === 'settings/shortcuts') {
    const overview = await buildSettingsOverview();
    return success(overview.shortcuts);
  }
  if (method === 'GET' && path === 'cash-register/current') {
    const overview = await buildSettingsOverview();
    return success(overview.cashRegisterCurrent || null);
  }
  if (method === 'GET' && path === 'sales/hold-carts') {
    const items = await electronListHoldCartsLocal();
    return success(items);
  }
  const resumeHoldMatch = path.match(/^sales\/hold-carts\/([^/]+)\/resume$/);
  if (method === 'POST' && resumeHoldMatch) {
    const cart = await electronResumeHoldCartLocal(resumeHoldMatch[1]);
    return success(cart);
  }
  const invoiceMatch = path.match(/^invoices\/([^/]+)\/pdf$/);
  if (method === 'GET' && invoiceMatch) {
    const format = parsed.params?.format || 'thermal';
    const result = await electronGetLocalInvoicePdf(invoiceMatch[1], format);
    return {
      data: {
        blob: base64ToBlob(result.base64),
        invoiceNumber: result.invoiceNumber,
        format: result.format,
      },
    };
  }
  return null;
}

export function parseRequestArgs(args) {
  return parseArgs(args);
}

export async function tryOfflineWrite(args) {
  if (!hasElectronBridge()) {
    return null;
  }
  return handleOfflineWrite(parseArgs(args));
}

export async function tryOfflineRead(args) {
  if (!hasElectronBridge()) {
    return null;
  }
  const result = await handleOfflineRead(parseArgs(args));
  return result;
}

export function isNetworkFailure(result) {
  if (!result?.error) {
    return false;
  }
  const status = result.error.status;
  return (
    status === 'FETCH_ERROR' ||
    status === 'TIMEOUT_ERROR' ||
    status === 'PARSING_ERROR' ||
    status === 'CUSTOM_ERROR' ||
    (typeof status === 'number' && status >= 500)
  );
}
