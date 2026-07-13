import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import CustomerForm from '../organisms/CustomerForm';
import CustomersTable from '../organisms/CustomersTable';
import { useAuth } from '../hooks/useAuth';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useCreateCustomerMutation,
  useDeactivateCustomerMutation,
  useGetCustomerQuery,
  useListCustomersQuery,
  useUpdateCustomerMutation,
} from '../store/customersApi';

const activeFilters = ['', 'true', 'false'];

export default function CustomersPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission('customers.view');
  const canManage = hasPermission('customers.manage');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewCustomerId, setViewCustomerId] = useState(null);
  const [formError, setFormError] = useState('');
  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(activeFilter === 'true' ? { isActive: true } : {}),
      ...(activeFilter === 'false' ? { isActive: false } : {}),
    }),
    [page, search, activeFilter]
  );
  const { data, isLoading, isFetching, error } = useListCustomersQuery(queryParams, {
    skip: !canView,
  });
  const { data: viewedCustomer, isLoading: isDetailLoading } = useGetCustomerQuery(viewCustomerId, {
    skip: !viewCustomerId,
  });
  const [createCustomer, { isLoading: isCreating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();
  const [deactivateCustomer, { isLoading: isDeactivating }] = useDeactivateCustomerMutation();
  const isSubmitting = isCreating || isUpdating;
  const customers = data?.items ?? [];
  const meta = data?.meta;

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingCustomer(null);
    setFormMode('create');
  }

  function openEditForm(customer) {
    setFormError('');
    setEditingCustomer(customer);
    setFormMode('edit');
  }

  function closeForm() {
    setFormError('');
    setEditingCustomer(null);
    setFormMode(null);
  }

  async function handleSubmit(values) {
    setFormError('');
    try {
      if (formMode === 'create') {
        await createCustomer(values).unwrap();
        toast.success(t('customers.createSuccess'));
      } else if (editingCustomer) {
        await updateCustomer({ customerId: editingCustomer.id, body: values }).unwrap();
        toast.success(t('customers.updateSuccess'));
      }
      closeForm();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, t('customers.errors.saveFailed')));
    }
  }

  async function handleDeactivate(customer) {
    if (!window.confirm(t('customers.deactivateConfirm', { name: customer.name }))) {
      return;
    }
    try {
      await deactivateCustomer(customer.id).unwrap();
      toast.success(t('customers.deactivateSuccess'));
      if (viewCustomerId === customer.id) {
        setViewCustomerId(null);
      }
      if (editingCustomer?.id === customer.id) {
        closeForm();
      }
    } catch (deactivateError) {
      toast.error(getErrorMessage(deactivateError, t('customers.errors.deactivateFailed')));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('customers.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('customers.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={openCreateForm}>
            <Plus size={16} />
            {t('customers.addCustomer')}
          </Button>
        ) : null}
      </div>
      {formMode ? (
        <div className="mb-6">
          <h2 className="mb-3 text-[16px] font-semibold">
            {formMode === 'create' ? t('customers.createTitle') : t('customers.editTitle')}
          </h2>
          <CustomerForm
            initialValues={editingCustomer || undefined}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
            submitLabel={formMode === 'create' ? t('customers.form.create') : t('customers.form.save')}
            errorMessage={formError}
          />
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex min-w-[240px] flex-1 gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            {t('customers.search')}
          </Button>
        </form>
        <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
          {activeFilters.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => {
                setActiveFilter(value);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                activeFilter === value
                  ? 'bg-[#eef2ff] text-primary'
                  : 'text-muted hover:bg-[#f4f4f8]'
              )}
            >
              {value === ''
                ? t('customers.filters.all')
                : value === 'true'
                  ? t('customers.status.active')
                  : t('customers.status.inactive')}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <div className="rounded-xl border border-danger/20 bg-[#fef2f2] px-4 py-3 text-[13px] text-danger">
          {getErrorMessage(error, t('customers.errors.loadFailed'))}
        </div>
      ) : (
        <CustomersTable
          customers={customers}
          isLoading={isLoading}
          canManage={canManage}
          onEdit={openEditForm}
          onView={(customer) => setViewCustomerId(customer.id)}
          onDeactivate={handleDeactivate}
        />
      )}
      {meta ? (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <p className="text-muted">
            {t('customers.pagination.summary', {
              from: customers.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || isFetching || isDeactivating}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('customers.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || isFetching || isDeactivating}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('customers.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
      {viewCustomerId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            className="flex-1"
            onClick={() => setViewCustomerId(null)}
            aria-label={t('pos.close')}
          />
          <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">{viewedCustomer?.name}</h2>
                <p className="text-[13px] text-muted">{t('customers.detailSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewCustomerId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[#f4f4f8]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {isDetailLoading || !viewedCustomer ? (
                <p className="text-[13px] text-muted">{t('customers.loading')}</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-muted">{t('customers.form.phone')}</p>
                      <p className="font-medium">{viewedCustomer.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted">{t('customers.form.email')}</p>
                      <p className="font-medium">{viewedCustomer.email || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted">{t('customers.form.address')}</p>
                      <p className="font-medium">{viewedCustomer.address || '—'}</p>
                    </div>
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted">{t('customers.table.purchases')}</p>
                      <p className="mt-1 text-[18px] font-semibold">{viewedCustomer.saleCount}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted">{t('customers.table.totalSpent')}</p>
                      <p className="mt-1 text-[18px] font-semibold">
                        {formatMoney(viewedCustomer.totalSpent)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted">{t('customers.loyalty')}</p>
                      <p className="mt-1 text-[18px] font-semibold">{viewedCustomer.loyaltyPoints}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">
                      {t('customers.recentPurchases')}
                    </p>
                    {viewedCustomer.recentSales?.length ? (
                      <div className="space-y-2">
                        {viewedCustomer.recentSales.map((sale) => (
                          <div
                            key={sale.id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]"
                          >
                            <div>
                              <p className="font-medium">{sale.invoiceNumber}</p>
                              <p className="text-[12px] text-muted">
                                {new Date(sale.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="font-semibold">{formatMoney(sale.total)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted">{t('customers.noPurchases')}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
