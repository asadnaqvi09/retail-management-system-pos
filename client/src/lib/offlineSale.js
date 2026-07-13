function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function mergeSaleLines(lines) {
  const merged = new Map();
  lines.forEach((line) => {
    const existing = merged.get(line.variantId);
    if (existing) {
      existing.quantity += line.quantity;
      existing.lineDiscount = roundMoney(existing.lineDiscount + (line.lineDiscount || 0));
    } else {
      merged.set(line.variantId, {
        variantId: line.variantId,
        quantity: line.quantity,
        lineDiscount: roundMoney(line.lineDiscount || 0),
      });
    }
  });
  return Array.from(merged.values());
}

export function computePreviewTotals(lines, variantMap) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  const computedLines = lines.map((line) => {
    const variant = variantMap.get(line.variantId);
    if (!variant) {
      throw new Error('Variant not found in local cache');
    }
    const unitPrice = Number(variant.unitPrice ?? variant.sellingPrice ?? 0);
    const lineSubtotal = roundMoney(unitPrice * line.quantity);
    const lineDiscount = roundMoney(Math.min(line.lineDiscount || 0, lineSubtotal));
    const taxable = roundMoney(lineSubtotal - lineDiscount);
    const taxAmount = roundMoney(taxable * Number(variant.taxRate || 0) / 100);
    const lineTotal = roundMoney(taxable + taxAmount);
    subtotal = roundMoney(subtotal + lineSubtotal);
    discountTotal = roundMoney(discountTotal + lineDiscount);
    taxTotal = roundMoney(taxTotal + taxAmount);
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice,
      lineDiscount,
      taxAmount,
      lineTotal,
      sku: variant.sku,
      productName: variant.product?.name || '',
    };
  });
  const total = roundMoney(subtotal - discountTotal + taxTotal);
  return {
    subtotal,
    discountTotal,
    promoDiscountTotal: 0,
    taxTotal,
    total,
    lines: computedLines,
  };
}

export function buildOfflineInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `OFF-${datePart}-${suffix}`;
}
