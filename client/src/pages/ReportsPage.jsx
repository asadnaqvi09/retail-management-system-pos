import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import { useAuth } from '../hooks/useAuth';
import { formatMoney } from '../lib/format';
import { downloadBlob } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import { printPdfBlob } from '../lib/printInvoice';
import {
  useGetSalesReportQuery,
  useGetRevenueReportQuery,
  useGetProfitReportQuery,
  useGetInventoryReportQuery,
  useGetTopSellingReportQuery,
  useGetLowSellingReportQuery,
  useGetCashierPerformanceReportQuery,
  useGetReturnsReportQuery,
  useGetExchangesReportQuery,
  useGetPaymentMethodsReportQuery,
  useExportReportMutation,
} from '../store/reportsApi';

const REPORT_TABS = [
  { id: 'sales', usesDateRange: true },
  { id: 'revenue', usesDateRange: true },
  { id: 'profit', usesDateRange: true },
  { id: 'inventory', usesDateRange: false },
  { id: 'top-selling', usesDateRange: true },
  { id: 'low-selling', usesDateRange: true },
  { id: 'cashier-performance', usesDateRange: true },
  { id: 'returns', usesDateRange: true },
  { id: 'exchanges', usesDateRange: true },
  { id: 'payment-methods', usesDateRange: true },
];

function defaultDateFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

function formatPaymentMethod(t, method) {
  const key = method === 'bank_transfer' ? 'bankTransfer' : method;
  return t(`pos.payment.${key}`, { defaultValue: method });
}

function ReportTable({ headers, rows, emptyLabel }) {
  if (!rows.length) {
    return <p className="text-[13px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-border bg-background text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border/70">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCards({ items }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-white p-4">
          <p className="text-[12px] text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission('reports.view');
  const canExport = hasPermission('reports.export');
  const [activeTab, setActiveTab] = useState('sales');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [salesRange, setSalesRange] = useState('daily');
  const [revenueGroupBy, setRevenueGroupBy] = useState('category');
  const [exportReport, { isLoading: isExporting }] = useExportReportMutation();

  const dateParams = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    [dateFrom, dateTo]
  );

  const salesQuery = useGetSalesReportQuery(
    { ...dateParams, range: salesRange },
    { skip: !canView || activeTab !== 'sales' }
  );
  const revenueQuery = useGetRevenueReportQuery(
    { ...dateParams, groupBy: revenueGroupBy },
    { skip: !canView || activeTab !== 'revenue' }
  );
  const profitQuery = useGetProfitReportQuery(dateParams, {
    skip: !canView || activeTab !== 'profit',
  });
  const inventoryQuery = useGetInventoryReportQuery(
    { deadStockDays: 90 },
    { skip: !canView || activeTab !== 'inventory' }
  );
  const topSellingQuery = useGetTopSellingReportQuery(dateParams, {
    skip: !canView || activeTab !== 'top-selling',
  });
  const lowSellingQuery = useGetLowSellingReportQuery(dateParams, {
    skip: !canView || activeTab !== 'low-selling',
  });
  const cashierQuery = useGetCashierPerformanceReportQuery(dateParams, {
    skip: !canView || activeTab !== 'cashier-performance',
  });
  const returnsQuery = useGetReturnsReportQuery(dateParams, {
    skip: !canView || activeTab !== 'returns',
  });
  const exchangesQuery = useGetExchangesReportQuery(dateParams, {
    skip: !canView || activeTab !== 'exchanges',
  });
  const paymentMethodsQuery = useGetPaymentMethodsReportQuery(dateParams, {
    skip: !canView || activeTab !== 'payment-methods',
  });

  const activeTabConfig = REPORT_TABS.find((tab) => tab.id === activeTab);
  const activeQueryMap = {
    sales: salesQuery,
    revenue: revenueQuery,
    profit: profitQuery,
    inventory: inventoryQuery,
    'top-selling': topSellingQuery,
    'low-selling': lowSellingQuery,
    'cashier-performance': cashierQuery,
    returns: returnsQuery,
    exchanges: exchangesQuery,
    'payment-methods': paymentMethodsQuery,
  };
  const activeQuery = activeQueryMap[activeTab];

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  function buildExportParams() {
    const params = { ...dateParams };
    if (activeTab === 'sales') {
      params.range = salesRange;
    }
    if (activeTab === 'revenue') {
      params.groupBy = revenueGroupBy;
    }
    if (activeTab === 'inventory') {
      params.deadStockDays = 90;
    }
    return params;
  }

  async function handleExport(format) {
    try {
      const result = await exportReport({
        reportKey: activeTab,
        format,
        params: buildExportParams(),
      }).unwrap();
      downloadBlob(result.blob, result.filename);
      toast.success(t('reports.exportSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('reports.errors.exportFailed')));
    }
  }

  async function handlePrint() {
    try {
      const result = await exportReport({
        reportKey: activeTab,
        format: 'pdf',
        params: buildExportParams(),
      }).unwrap();
      await printPdfBlob(result.blob, result.filename);
    } catch (error) {
      toast.error(getErrorMessage(error, t('reports.errors.printFailed')));
    }
  }

  function renderReportContent() {
    if (activeQuery.isLoading) {
      return <p className="text-[13px] text-muted-foreground">{t('reports.loading')}</p>;
    }
    if (activeQuery.error) {
      return (
        <p className="text-[13px] text-danger">
          {getErrorMessage(activeQuery.error, t('reports.errors.loadFailed'))}
        </p>
      );
    }
    const data = activeQuery.data;
    if (!data) {
      return null;
    }

    switch (activeTab) {
      case 'sales':
        return (
          <>
            <SummaryCards
              items={[
                { label: t('reports.sales.totalSales'), value: data.summary.saleCount },
                { label: t('reports.sales.revenue'), value: formatMoney(data.summary.revenue) },
                {
                  label: t('reports.sales.discounts'),
                  value: formatMoney(data.summary.discountTotal),
                },
                { label: t('reports.sales.tax'), value: formatMoney(data.summary.taxTotal) },
              ]}
            />
            <ReportTable
              headers={[
                t('reports.sales.period'),
                t('reports.sales.saleCount'),
                t('reports.sales.revenue'),
                t('reports.sales.discounts'),
              ]}
              rows={data.periods.map((row) => [
                row.label,
                row.saleCount,
                formatMoney(row.revenue),
                formatMoney(row.discountTotal),
              ])}
              emptyLabel={t('reports.empty')}
            />
            {data.transactions?.length ? (
              <div className="mt-4">
                <h3 className="mb-3 text-[15px] font-semibold">{t('reports.sales.transactions')}</h3>
                <ReportTable
                  headers={[
                    t('reports.sales.invoice'),
                    t('reports.sales.cashier'),
                    t('reports.sales.customer'),
                    t('reports.sales.revenue'),
                    t('reports.sales.date'),
                  ]}
                  rows={data.transactions.map((row) => [
                    row.invoiceNumber,
                    row.cashierName,
                    row.customerName || t('sales.walkInCustomer'),
                    formatMoney(row.total),
                    new Date(row.createdAt).toLocaleString(),
                  ])}
                  emptyLabel={t('reports.empty')}
                />
              </div>
            ) : null}
          </>
        );
      case 'revenue':
        return (
          <>
            <SummaryCards
              items={[
                {
                  label: t('reports.revenue.total'),
                  value: formatMoney(data.totalRevenue),
                },
              ]}
            />
            <ReportTable
              headers={[
                t('reports.revenue.name'),
                t('reports.revenue.quantity'),
                t('reports.revenue.amount'),
                t('reports.revenue.share'),
              ]}
              rows={data.items.map((row) => [
                row.name,
                row.quantity,
                formatMoney(row.revenue),
                `${row.sharePercent}%`,
              ])}
              emptyLabel={t('reports.empty')}
            />
          </>
        );
      case 'profit':
        return (
          <SummaryCards
            items={[
              { label: t('reports.profit.revenue'), value: formatMoney(data.revenue) },
              { label: t('reports.profit.cogs'), value: formatMoney(data.cogs) },
              { label: t('reports.profit.gross'), value: formatMoney(data.grossProfit) },
              { label: t('reports.profit.expenses'), value: formatMoney(data.expenses) },
              { label: t('reports.profit.net'), value: formatMoney(data.netProfit) },
            ]}
          />
        );
      case 'inventory':
        return (
          <>
            <SummaryCards
              items={[
                {
                  label: t('reports.inventory.costValue'),
                  value: formatMoney(data.valuation.totalCostValue),
                },
                {
                  label: t('reports.inventory.retailValue'),
                  value: formatMoney(data.valuation.totalRetailValue),
                },
                {
                  label: t('reports.inventory.skus'),
                  value: data.valuation.itemCount,
                },
                {
                  label: t('reports.inventory.deadStock'),
                  value: data.deadStock.length,
                },
              ]}
            />
            <div className="mb-4">
              <h3 className="mb-3 text-[15px] font-semibold">{t('reports.inventory.valuation')}</h3>
              <ReportTable
                headers={[
                  t('reports.inventory.sku'),
                  t('reports.inventory.product'),
                  t('reports.inventory.quantity'),
                  t('reports.inventory.costValue'),
                  t('reports.inventory.retailValue'),
                ]}
                rows={data.valuation.items.slice(0, 20).map((row) => [
                  row.sku,
                  row.productName,
                  row.quantityOnHand,
                  formatMoney(row.costValue),
                  formatMoney(row.retailValue),
                ])}
                emptyLabel={t('reports.empty')}
              />
            </div>
            <div>
              <h3 className="mb-3 text-[15px] font-semibold">{t('reports.inventory.deadStockTitle')}</h3>
              <ReportTable
                headers={[
                  t('reports.inventory.sku'),
                  t('reports.inventory.product'),
                  t('reports.inventory.quantity'),
                  t('reports.inventory.lastSale'),
                ]}
                rows={data.deadStock.map((row) => [
                  row.sku,
                  row.productName,
                  row.quantityOnHand,
                  row.lastSaleAt ? new Date(row.lastSaleAt).toLocaleDateString() : t('reports.inventory.neverSold'),
                ])}
                emptyLabel={t('reports.empty')}
              />
            </div>
          </>
        );
      case 'top-selling':
      case 'low-selling':
        return (
          <ReportTable
            headers={[
              t('reports.products.product'),
              t('reports.products.sku'),
              t('reports.products.quantity'),
              t('reports.products.revenue'),
            ]}
            rows={data.items.map((row) => [
              row.productName,
              row.sku,
              row.quantitySold,
              formatMoney(row.revenue),
            ])}
            emptyLabel={t('reports.empty')}
          />
        );
      case 'cashier-performance':
        return (
          <ReportTable
            headers={[
              t('reports.cashier.name'),
              t('reports.cashier.sales'),
              t('reports.cashier.revenue'),
              t('reports.cashier.discounts'),
              t('reports.cashier.exchanges'),
              t('reports.cashier.returns'),
            ]}
            rows={data.items.map((row) => [
              row.cashierName,
              row.saleCount,
              formatMoney(row.revenue),
              formatMoney(row.discountTotal),
              row.exchangeCount,
              row.returnCount,
            ])}
            emptyLabel={t('reports.empty')}
          />
        );
      case 'returns':
        return (
          <>
            <SummaryCards
              items={[
                { label: t('reports.returns.count'), value: data.summary.returnCount },
                { label: t('reports.returns.value'), value: formatMoney(data.summary.returnValue) },
              ]}
            />
            <ReportTable
              headers={[
                t('reports.products.product'),
                t('reports.products.sku'),
                t('reports.products.quantity'),
                t('reports.products.revenue'),
              ]}
              rows={data.topProducts.map((row) => [
                row.productName,
                row.sku,
                row.quantity,
                formatMoney(row.value),
              ])}
              emptyLabel={t('reports.empty')}
            />
          </>
        );
      case 'exchanges':
        return (
          <>
            <SummaryCards
              items={[
                { label: t('reports.exchanges.count'), value: data.summary.exchangeCount },
                { label: t('reports.exchanges.net'), value: formatMoney(data.summary.netAmount) },
              ]}
            />
            <ReportTable
              headers={[
                t('reports.exchanges.from'),
                t('reports.exchanges.to'),
                t('reports.exchanges.count'),
              ]}
              rows={data.patterns.map((row) => [row.fromLabel, row.toLabel, row.count])}
              emptyLabel={t('reports.empty')}
            />
          </>
        );
      case 'payment-methods':
        return (
          <>
            <SummaryCards
              items={[
                { label: t('reports.payments.total'), value: formatMoney(data.totalAmount) },
              ]}
            />
            <ReportTable
              headers={[
                t('reports.payments.method'),
                t('reports.payments.transactions'),
                t('reports.payments.amount'),
                t('reports.payments.share'),
              ]}
              rows={data.items.map((row) => [
                formatPaymentMethod(t, row.method),
                row.transactionCount,
                formatMoney(row.amount),
                `${row.sharePercent}%`,
              ])}
              emptyLabel={t('reports.empty')}
            />
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('reports.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        {canExport ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={isExporting}>
              <Download size={14} />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('xlsx')} disabled={isExporting}>
              <Download size={14} />
              XLSX
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')} disabled={isExporting}>
              <Download size={14} />
              PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={isExporting}>
              <Printer size={14} />
              {t('reports.print')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
              activeTab === tab.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:bg-background'
            )}
          >
            {t(`reports.tabs.${tab.id}`)}
          </button>
        ))}
      </div>

      {activeTabConfig?.usesDateRange ? (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">{t('reports.dateFrom')}</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-10 w-[160px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">{t('reports.dateTo')}</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-10 w-[160px]"
            />
          </div>
          {activeTab === 'sales' ? (
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">{t('reports.sales.range')}</label>
              <select
                value={salesRange}
                onChange={(event) => setSalesRange(event.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-[13px]"
              >
                {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
                  <option key={range} value={range}>
                    {t(`reports.sales.ranges.${range}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {activeTab === 'revenue' ? (
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">{t('reports.revenue.groupBy')}</label>
              <select
                value={revenueGroupBy}
                onChange={(event) => setRevenueGroupBy(event.target.value)}
                className="h-10 rounded-lg border border-border px-3 text-[13px]"
              >
                {['category', 'brand', 'product'].map((group) => (
                  <option key={group} value={group}>
                    {t(`reports.revenue.groups.${group}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {renderReportContent()}
    </div>
  );
}
