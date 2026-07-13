const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { exportableReports } = require('./reports.validation');

function flattenRows(reportKey, data) {
  switch (reportKey) {
    case 'sales':
      return (data.periods || []).map((row) => ({
        Period: row.label,
        Sales: row.saleCount,
        Revenue: row.revenue,
        Discounts: row.discountTotal,
        Tax: row.taxTotal,
      }));
    case 'revenue':
      return (data.items || []).map((row) => ({
        Name: row.name,
        Quantity: row.quantity,
        Revenue: row.revenue,
        Share: row.sharePercent,
      }));
    case 'profit':
      return [
        {
          Metric: 'Revenue',
          Amount: data.revenue,
        },
        { Metric: 'COGS', Amount: data.cogs },
        { Metric: 'Gross Profit', Amount: data.grossProfit },
        { Metric: 'Expenses', Amount: data.expenses },
        { Metric: 'Net Profit', Amount: data.netProfit },
      ];
    case 'inventory':
      return [
        ...(data.valuation?.items || []).map((row) => ({
          SKU: row.sku,
          Product: row.productName,
          Quantity: row.quantityOnHand,
          CostValue: row.costValue,
          RetailValue: row.retailValue,
        })),
      ];
    case 'top-selling':
    case 'low-selling':
      return (data.items || []).map((row) => ({
        Product: row.productName,
        SKU: row.sku,
        Quantity: row.quantitySold,
        Revenue: row.revenue,
      }));
    case 'cashier-performance':
      return (data.items || []).map((row) => ({
        Cashier: row.cashierName,
        Sales: row.saleCount,
        Revenue: row.revenue,
        Discounts: row.discountTotal,
        Exchanges: row.exchangeCount,
        Returns: row.returnCount,
      }));
    case 'returns':
      return (data.topProducts || []).map((row) => ({
        Product: row.productName,
        SKU: row.sku,
        Quantity: row.quantity,
        Value: row.value,
      }));
    case 'exchanges':
      return (data.patterns || []).map((row) => ({
        From: row.fromLabel,
        To: row.toLabel,
        Count: row.count,
      }));
    case 'payment-methods':
      return (data.items || []).map((row) => ({
        Method: row.method,
        Transactions: row.transactionCount,
        Amount: row.amount,
        Share: row.sharePercent,
      }));
    default:
      return [];
  }
}

function buildCsv(reportKey, data) {
  const rows = flattenRows(reportKey, data);
  const csv = stringify(rows, { header: true });
  return {
    buffer: Buffer.from(csv, 'utf8'),
    contentType: 'text/csv',
    filename: `${reportKey}-${Date.now()}.csv`,
  };
}

async function buildXlsx(reportKey, data) {
  const rows = flattenRows(reportKey, data);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(reportKey);
  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    rows.forEach((row) => sheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${reportKey}-${Date.now()}.xlsx`,
  };
}

function buildPdf(reportKey, data, meta = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        contentType: 'application/pdf',
        filename: `${reportKey}-${Date.now()}.pdf`,
      });
    });
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text(meta.title || `Report: ${reportKey}`);
    if (meta.subtitle) {
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#6B6B80').text(meta.subtitle);
    }
    doc.moveDown(0.8);
    doc.fillColor('#0F0F14');

    const rows = flattenRows(reportKey, data);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(11).text('No data available for the selected filters.');
    } else {
      const headers = Object.keys(rows[0]);
      doc.font('Helvetica-Bold').fontSize(9);
      headers.forEach((header, index) => {
        doc.text(header, 40 + index * 90, doc.y, { width: 85, continued: index < headers.length - 1 });
      });
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(8);
      rows.forEach((row) => {
        const y = doc.y;
        if (y > 760) {
          doc.addPage();
        }
        headers.forEach((header, index) => {
          doc.text(String(row[header] ?? ''), 40 + index * 90, doc.y === y ? y : doc.y, {
            width: 85,
            continued: index < headers.length - 1,
          });
        });
        doc.moveDown(0.5);
      });
    }
    doc.end();
  });
}

async function exportReport(reportKey, data, format, meta = {}) {
  if (!exportableReports.includes(reportKey)) {
    throw new Error(`Unsupported report export: ${reportKey}`);
  }
  if (format === 'pdf') {
    return buildPdf(reportKey, data, meta);
  }
  if (format === 'xlsx') {
    return buildXlsx(reportKey, data);
  }
  return buildCsv(reportKey, data);
}

module.exports = {
  exportReport,
  flattenRows,
};
