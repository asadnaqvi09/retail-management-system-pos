const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const dayjs = require('dayjs');

const THERMAL_WIDTH = 226.77;
const PAGE_MARGIN = 12;

const PAYMENT_LABELS = {
  cash: 'Cash',
  card: 'Card',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  bank_transfer: 'Bank Transfer',
  store_credit: 'Store Credit',
};

function formatMoney(amount, symbol) {
  const value = Number(amount) || 0;
  return `${symbol} ${value.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatAttributes(attributes) {
  if (!attributes?.length) {
    return '';
  }
  return attributes.map((item) => item.value).join(' / ');
}

function paymentLabel(method) {
  return PAYMENT_LABELS[method] || method;
}

async function renderBarcodePng(text) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 2,
    height: 10,
    includetext: false,
    textxalign: 'center',
  });
}

async function renderQrPng(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 120,
  });
}

function drawDivider(doc, width) {
  const y = doc.y;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(width - PAGE_MARGIN, y)
    .strokeColor('#E8E8EE')
    .stroke();
  doc.moveDown(0.4);
}

function drawKeyValue(doc, label, value, width, options = {}) {
  const { boldValue = false } = options;
  doc.font('Helvetica').fontSize(8).fillColor('#6B6B80').text(label, PAGE_MARGIN, doc.y, {
    width: width - PAGE_MARGIN * 2,
  });
  doc
    .font(boldValue ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9)
    .fillColor('#0F0F14')
    .text(value, PAGE_MARGIN, doc.y, { width: width - PAGE_MARGIN * 2 });
  doc.moveDown(0.3);
}

async function buildInvoicePdf(payload, format) {
  const isThermal = format === 'thermal';
  const pageWidth = isThermal ? THERMAL_WIDTH : 595.28;
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const doc = new PDFDocument({
    size: isThermal ? [pageWidth, 600] : 'A4',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    autoFirstPage: true,
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const { store, receipt, sale } = payload;
  const symbol = store.currencySymbol;

  doc.font('Helvetica-Bold').fontSize(isThermal ? 12 : 16).fillColor('#0F0F14');
  doc.text(store.name, PAGE_MARGIN, doc.y, { width: contentWidth, align: 'center' });
  doc.moveDown(0.2);

  if (receipt.headerText) {
    doc.font('Helvetica').fontSize(8).fillColor('#6B6B80').text(receipt.headerText, {
      width: contentWidth,
      align: 'center',
    });
    doc.moveDown(0.3);
  }

  const addressParts = [store.address, store.city, store.country].filter(Boolean);
  if (addressParts.length) {
    doc.font('Helvetica').fontSize(8).fillColor('#6B6B80').text(addressParts.join(', '), {
      width: contentWidth,
      align: 'center',
    });
  }
  if (store.phone) {
    doc.text(store.phone, { width: contentWidth, align: 'center' });
  }
  if (store.email) {
    doc.text(store.email, { width: contentWidth, align: 'center' });
  }

  doc.moveDown(0.5);
  drawDivider(doc, pageWidth);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F0F14');
  doc.text('INVOICE', { width: contentWidth, align: 'center' });
  doc.moveDown(0.3);

  drawKeyValue(doc, 'Invoice #', sale.invoiceNumber, pageWidth, { boldValue: true });
  drawKeyValue(
    doc,
    'Date',
    dayjs(sale.createdAt).format('DD MMM YYYY, hh:mm A'),
    pageWidth
  );
  drawKeyValue(doc, 'Cashier', sale.user.name, pageWidth);
  if (sale.customer) {
    drawKeyValue(
      doc,
      'Customer',
      sale.customer.phone ? `${sale.customer.name} (${sale.customer.phone})` : sale.customer.name,
      pageWidth
    );
  }

  doc.moveDown(0.2);
  drawDivider(doc, pageWidth);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F0F14');
  doc.text('ITEMS', PAGE_MARGIN, doc.y);
  doc.moveDown(0.4);

  sale.lines.forEach((line) => {
    const variantLabel = formatAttributes(line.attributes);
    const title = variantLabel ? `${line.productName} (${variantLabel})` : line.productName;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F0F14').text(title, {
      width: contentWidth,
    });
    const qtyPrice = `${line.quantity} x ${formatMoney(line.unitPrice, symbol)}`;
    const lineTotal = formatMoney(line.lineTotal, symbol);
    doc.font('Helvetica').fontSize(8).fillColor('#6B6B80').text(qtyPrice, {
      continued: true,
      width: contentWidth * 0.65,
    });
    doc.text(lineTotal, { align: 'right', width: contentWidth });
    if (line.lineDiscount > 0) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#D97706')
        .text(`Discount: -${formatMoney(line.lineDiscount, symbol)}`, { width: contentWidth });
    }
    if (line.sku) {
      doc.font('Helvetica').fontSize(7).fillColor('#6B6B80').text(`SKU: ${line.sku}`, {
        width: contentWidth,
      });
    }
    doc.moveDown(0.35);
  });

  drawDivider(doc, pageWidth);

  const totals = [
    ['Subtotal', formatMoney(sale.subtotal, symbol)],
    ...(sale.discountTotal > 0
      ? [['Discount', `-${formatMoney(sale.discountTotal, symbol)}`]]
      : []),
    ...(sale.taxTotal > 0 ? [['Tax', formatMoney(sale.taxTotal, symbol)]] : []),
    ['Total', formatMoney(sale.total, symbol)],
  ];

  totals.forEach(([label, value], index) => {
    const isTotal = index === totals.length - 1;
    doc
      .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isTotal ? 10 : 8)
      .fillColor('#0F0F14')
      .text(label, PAGE_MARGIN, doc.y, { continued: true, width: contentWidth * 0.6 });
    doc.text(value, { align: 'right', width: contentWidth });
    doc.moveDown(0.2);
  });

  doc.moveDown(0.2);
  drawDivider(doc, pageWidth);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F0F14').text('PAYMENT');
  doc.moveDown(0.3);

  sale.payments.forEach((payment) => {
    drawKeyValue(doc, paymentLabel(payment.method), formatMoney(payment.amount, symbol), pageWidth);
    if (payment.tenderedAmount != null) {
      drawKeyValue(
        doc,
        'Tendered',
        formatMoney(payment.tenderedAmount, symbol),
        pageWidth
      );
    }
    if (payment.changeAmount != null && payment.changeAmount > 0) {
      drawKeyValue(doc, 'Change', formatMoney(payment.changeAmount, symbol), pageWidth);
    }
  });

  doc.moveDown(0.3);
  drawDivider(doc, pageWidth);

  try {
    const barcodeBuffer = await renderBarcodePng(sale.invoiceNumber);
    const barcodeWidth = isThermal ? contentWidth * 0.85 : 180;
    const barcodeX = PAGE_MARGIN + (contentWidth - barcodeWidth) / 2;
    doc.image(barcodeBuffer, barcodeX, doc.y, { width: barcodeWidth });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(7).fillColor('#6B6B80').text(sale.invoiceNumber, {
      width: contentWidth,
      align: 'center',
    });
    doc.moveDown(0.4);

    const qrBuffer = await renderQrPng(sale.invoiceNumber);
    const qrSize = isThermal ? 72 : 90;
    const qrX = PAGE_MARGIN + (contentWidth - qrSize) / 2;
    doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
    doc.moveDown(0.5);
  } catch (error) {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#DC2626')
      .text('Barcode/QR unavailable', { width: contentWidth, align: 'center' });
    doc.moveDown(0.3);
  }

  if (receipt.returnPolicyText) {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#6B6B80')
      .text(receipt.returnPolicyText, { width: contentWidth, align: 'center' });
    doc.moveDown(0.3);
  }
  if (receipt.thankYouMessage) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#4F46E5')
      .text(receipt.thankYouMessage, { width: contentWidth, align: 'center' });
  }
  if (receipt.footerText) {
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#6B6B80')
      .text(receipt.footerText, { width: contentWidth, align: 'center' });
  }

  doc.end();
  return finished;
}

module.exports = {
  buildInvoicePdf,
  formatMoney,
  paymentLabel,
};
