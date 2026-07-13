import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import Badge from '../atoms/Badge';
import { useAuth } from '../hooks/useAuth';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import {
  useListSalesQuery,
  useGetSaleQuery,
  useVoidSaleMutation,
} from '../store/salesApi';
import { cn } from '../lib/utils';

function formatAttributes(attributes) {
  if (!attributes?.length) return '—';
  return attributes.map((item) => item.value).join(' / ');
}

export default function SalesHistoryPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission('sales.view');
  const canVoid = hasPermission('sales.void');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
    }),
    [page, search]
  );
  const { data, isLoading, isFetching, error } = useListSalesQuery(queryParams, {
    skip: !canView,
  });
  const { data: selectedSale, isLoading: isDetailLoading } = useGetSaleQuery(selectedSaleId, {
    skip: !selectedSaleId,
  });
  const [voidSale, { isLoading: isVoiding }] = useVoidSaleMutation();

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleVoidSale(saleId) {
    if (!window.confirm(t('sales.voidConfirm'))) {
      return;
    }
    try {
      await voidSale(saleId).unwrap();
      toast.success(t('sales.voidSuccess'));
      setSelectedSaleId(null);
    } catch (voidError) {
      toast.error(getErrorMessage(voidError, t('sales.errors.voidFailed')));
    }
  }

  const sales = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold">{t('sales.title')}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t('sales.subtitle')}</p>
      </div>
      <form onSubmit={handleSearchSubmit} className="mb-4 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('sales.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          {t('sales.search')}
        </Button>
      </form>
      {error ? (
        <div className="rounded-xl border border-danger/20 bg-[#fef2f2] px-4 py-3 text-[13px] text-danger">
          {getErrorMessage(error, t('sales.errors.loadFailed'))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border bg-[#fafafa] text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t('sales.table.invoice')}</th>
                <th className="px-4 py-3 font-medium">{t('sales.table.date')}</th>
                <th className="px-4 py-3 font-medium">{t('sales.table.cashier')}</th>
                <th className="px-4 py-3 font-medium">{t('sales.table.customer')}</th>
                <th className="px-4 py-3 font-medium">{t('sales.table.total')}</th>
                <th className="px-4 py-3 font-medium">{t('sales.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('sales.loading')}
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('sales.emptyTitle')}
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedSaleId(sale.id)}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-[#fafafa]"
                  >
                    <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{sale.user?.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {sale.customer?.name || t('sales.walkInCustomer')}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatMoney(sale.total)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          sale.status === 'voided'
                            ? 'bg-[#fef2f2] text-danger'
                            : 'bg-[#f0fdf4] text-success'
                        )}
                      >
                        {t(`sales.status.${sale.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {meta ? (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <p className="text-muted">
            {t('sales.pagination.summary', {
              from: sales.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('sales.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('sales.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
      {selectedSaleId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            className="flex-1"
            onClick={() => setSelectedSaleId(null)}
            aria-label={t('pos.close')}
          />
          <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">{selectedSale?.invoiceNumber}</h2>
                <p className="text-[13px] text-muted">
                  {selectedSale
                    ? new Date(selectedSale.createdAt).toLocaleString()
                    : t('sales.loading')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[#f4f4f8]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {isDetailLoading || !selectedSale ? (
                <p className="text-[13px] text-muted">{t('sales.loading')}</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-muted">{t('sales.table.cashier')}</p>
                      <p className="font-medium">{selectedSale.user?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted">{t('sales.table.customer')}</p>
                      <p className="font-medium">
                        {selectedSale.customer?.name || t('sales.walkInCustomer')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {selectedSale.lines.map((line) => (
                      <div key={line.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{line.productName}</p>
                            <p className="text-[12px] text-muted">
                              {line.sku} · {formatAttributes(line.attributes)}
                            </p>
                            <p className="text-[12px] text-muted">
                              {line.quantity} x {formatMoney(line.unitPriceAtSale)}
                            </p>
                          </div>
                          <p className="font-semibold">{formatMoney(line.lineTotal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted">{t('pos.subtotal')}</span>
                      <span>{formatMoney(selectedSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('pos.tax')}</span>
                      <span>{formatMoney(selectedSale.taxTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[15px] font-bold">
                      <span>{t('pos.total')}</span>
                      <span className="text-primary">{formatMoney(selectedSale.total)}</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
                      {t('sales.payments')}
                    </p>
                    {selectedSale.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg bg-[#fafafa] px-3 py-2 text-[13px]"
                      >
                        <span>{t(`pos.payment.${payment.method}`)}</span>
                        <span className="font-medium">{formatMoney(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {canVoid && selectedSale?.status === 'completed' ? (
              <div className="border-t border-border p-5">
                <Button
                  variant="outline"
                  className="w-full text-danger hover:text-danger"
                  disabled={isVoiding}
                  onClick={() => handleVoidSale(selectedSale.id)}
                >
                  {isVoiding ? t('sales.voiding') : t('sales.void')}
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
