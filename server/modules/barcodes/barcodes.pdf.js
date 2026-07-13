const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

const MM_TO_PT = 2.834645669;

const TEMPLATE_CONFIG = {
  '40x30': {
    key: '40x30',
    widthMm: 40,
    heightMm: 30,
    layout: 'roll',
  },
  '50x25': {
    key: '50x25',
    widthMm: 50,
    heightMm: 25,
    layout: 'roll',
  },
  a4_sheet: {
    key: 'a4_sheet',
    widthMm: 40,
    heightMm: 30,
    layout: 'sheet',
    pageSize: 'A4',
    columns: 4,
    rows: 9,
    gapMm: 2,
    marginMm: 5,
  },
};

function formatMoney(amount, symbol) {
  const value = Number(amount) || 0;
  return `${symbol} ${value.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatVariantLabel(attributes) {
  if (!attributes?.length) {
    return '';
  }
  return attributes.map((item) => item.value).join(' / ');
}

async function renderBarcodePng(text) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: String(text),
    scale: 2,
    height: 8,
    includetext: false,
    textxalign: 'center',
  });
}

function mm(value) {
  return value * MM_TO_PT;
}

async function drawLabel(doc, label, x, y, width, height) {
  const padding = mm(1.5);
  const innerWidth = width - padding * 2;
  let cursorY = y + padding;

  doc.save();
  doc.rect(x, y, width, height).strokeColor('#E8E8EE').lineWidth(0.5).stroke();

  doc.font('Helvetica').fontSize(5.5).fillColor('#6B6B80');
  doc.text(label.storeName, x + padding, cursorY, {
    width: innerWidth,
    align: 'center',
    lineBreak: false,
    ellipsis: true,
  });
  cursorY += 8;

  const variantSuffix = formatVariantLabel(label.attributes);
  const productLine = variantSuffix ? `${label.productName} – ${variantSuffix}` : label.productName;
  doc.font('Helvetica').fontSize(6.5).fillColor('#0F0F14');
  doc.text(productLine, x + padding, cursorY, {
    width: innerWidth,
    align: 'center',
    height: 12,
    ellipsis: true,
  });
  cursorY += 13;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#4F46E5');
  doc.text(formatMoney(label.price, label.currencySymbol), x + padding, cursorY, {
    width: innerWidth,
    align: 'center',
  });
  cursorY += 14;

  doc.font('Helvetica').fontSize(5.5).fillColor('#6B6B80');
  doc.text(`SKU: ${label.sku}`, x + padding, cursorY, {
    width: innerWidth,
    align: 'center',
  });
  cursorY += 7;

  try {
    const barcodeBuffer = await renderBarcodePng(label.barcode);
    const barcodeWidth = Math.min(innerWidth * 0.92, mm(34));
    const barcodeHeight = Math.min(height - (cursorY - y) - 10, mm(10));
    const barcodeX = x + padding + (innerWidth - barcodeWidth) / 2;
    doc.image(barcodeBuffer, barcodeX, cursorY, {
      width: barcodeWidth,
      height: barcodeHeight,
    });
    cursorY += barcodeHeight + 2;
    doc.font('Helvetica').fontSize(5).fillColor('#0F0F14').text(label.barcode, x + padding, cursorY, {
      width: innerWidth,
      align: 'center',
    });
  } catch (error) {
    doc.font('Helvetica').fontSize(5).fillColor('#DC2626').text(label.barcode, x + padding, cursorY, {
      width: innerWidth,
      align: 'center',
    });
  }

  doc.restore();
}

async function buildLabelsPdf(labels, templateKey) {
  const template = TEMPLATE_CONFIG[templateKey] || TEMPLATE_CONFIG['40x30'];
  const labelWidth = mm(template.widthMm);
  const labelHeight = mm(template.heightMm);
  const expandedLabels = [];

  labels.forEach((label) => {
    const count = Math.max(Number(label.copies) || 1, 1);
    for (let index = 0; index < count; index += 1) {
      expandedLabels.push(label);
    }
  });

  const doc = template.layout === 'sheet'
    ? new PDFDocument({
        size: template.pageSize,
        margins: { top: mm(template.marginMm), bottom: mm(template.marginMm), left: mm(template.marginMm), right: mm(template.marginMm) },
        autoFirstPage: true,
      })
    : new PDFDocument({
        size: [labelWidth, labelHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: false,
      });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (template.layout === 'sheet') {
    const gap = mm(template.gapMm);
    const pageWidth = doc.page.width - mm(template.marginMm) * 2;
    let index = 0;
    while (index < expandedLabels.length) {
      if (index > 0) {
        doc.addPage();
      }
      for (let row = 0; row < template.rows && index < expandedLabels.length; row += 1) {
        for (let col = 0; col < template.columns && index < expandedLabels.length; col += 1) {
          const x = mm(template.marginMm) + col * (labelWidth + gap);
          const y = mm(template.marginMm) + row * (labelHeight + gap);
          await drawLabel(doc, expandedLabels[index], x, y, labelWidth, labelHeight);
          index += 1;
        }
      }
    }
  } else {
    for (let index = 0; index < expandedLabels.length; index += 1) {
      if (index > 0) {
        doc.addPage({ size: [labelWidth, labelHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      } else {
        doc.addPage({ size: [labelWidth, labelHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      }
      await drawLabel(doc, expandedLabels[index], 0, 0, labelWidth, labelHeight);
    }
  }

  doc.end();
  const buffer = await finished;
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `labels-${template.key}-${Date.now()}.pdf`,
    template: template.key,
    labelCount: expandedLabels.length,
  };
}

module.exports = {
  TEMPLATE_CONFIG,
  buildLabelsPdf,
  formatMoney,
};
