import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, FolderTree, Building2, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import ProductsTable from '../organisms/ProductsTable';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { downloadBlob } from '../lib/format';
import {
  useExportProductsMutation,
  useImportProductsMutation,
  useListProductsQuery,
} from '../store/productsApi';
import { cn } from '../lib/utils';

const statusFilters = ['', 'active', 'draft', 'inactive'];

export default function ProductsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const importInputRef = useRef(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(status ? { status } : {}),
    }),
    [page, search, status]
  );
  const { data, isLoading, isFetching, error } = useListProductsQuery(queryParams);
  const [importProducts, { isLoading: isImporting }] = useImportProductsMutation();
  const [exportProducts, { isLoading: isExporting }] = useExportProductsMutation();
  const canCreate = hasPermission('products.create');
  const canExport = hasPermission('products.view');

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const summary = await importProducts(file).unwrap();
      toast.success(
        t('products.importSuccess', {
          created: summary.created,
          skipped: summary.skipped,
          failed: summary.failed,
        })
      );
      if (summary.failed > 0) {
        toast.error(t('products.importPartialFailed', { count: summary.failed }));
      }
    } catch (importError) {
      toast.error(getErrorMessage(importError, t('products.errors.importFailed')));
    }
  }

  async function handleExport(format) {
    try {
      const blob = await exportProducts({
        ...(status ? { status } : {}),
        format,
      }).unwrap();
      downloadBlob(blob, `products.${format}`);
      toast.success(t('products.exportSuccess'));
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, t('products.errors.exportFailed')));
    }
  }

  const products = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('products.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('products.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/products/categories"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-medium text-muted transition-colors hover:bg-[#f4f4f8]"
          >
            <FolderTree size={15} />
            {t('products.manageCategories')}
          </Link>
          <Link
            to="/products/brands"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-medium text-muted transition-colors hover:bg-[#f4f4f8]"
          >
            <Building2 size={15} />
            {t('products.manageBrands')}
          </Link>
          {canExport ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExport('csv')}
              >
                <Download size={15} />
                {t('products.exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExport('xlsx')}
              >
                <Download size={15} />
                {t('products.exportXlsx')}
              </Button>
            </>
          ) : null}
          {canCreate ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={15} />
                {isImporting ? t('products.importing') : t('products.import')}
              </Button>
              <Link
                to="/products/new"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#4338ca]"
              >
                <Plus size={15} />
                {t('products.addProduct')}
              </Link>
            </>
          ) : null}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('products.searchPlaceholder')}
            className="pl-9"
          />
        </form>
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#f4f4f8] p-1">
          {statusFilters.map((filterValue) => (
            <button
              key={filterValue || 'all'}
              type="button"
              onClick={() => {
                setStatus(filterValue);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                status === filterValue
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {filterValue ? t(`products.status.${filterValue}`) : t('products.filters.all')}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {getErrorMessage(error, t('products.errors.loadFailed'))}
        </div>
      ) : null}
      <ProductsTable products={products} isLoading={isLoading || isFetching} />
      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            {t('products.pagination.summary', {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('products.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('products.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
