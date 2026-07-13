import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Search, UserRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';
import CustomerForm from '../../organisms/CustomerForm';
import { cn } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errors';
import {
  useListCustomersQuery,
  useCreateCustomerMutation,
} from '../../store/customersApi';

export default function POSCustomerPicker({
  selectedCustomer,
  onSelect,
  canManage,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formError, setFormError] = useState('');
  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: 8,
      search,
      isActive: true,
    }),
    [search]
  );
  const { data, isFetching } = useListCustomersQuery(queryParams, { skip: !open });
  const [createCustomer, { isLoading: isCreating }] = useCreateCustomerMutation();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput, open]);

  const customers = data?.items ?? [];

  function handleSelectWalkIn() {
    onSelect(null);
    setOpen(false);
    setShowCreateForm(false);
  }

  function handleSelectCustomer(customer) {
    onSelect({ id: customer.id, name: customer.name, phone: customer.phone });
    setOpen(false);
    setShowCreateForm(false);
  }

  async function handleQuickCreate(values) {
    setFormError('');
    try {
      const customer = await createCustomer(values).unwrap();
      toast.success(t('customers.createSuccess'));
      onSelect({ id: customer.id, name: customer.name, phone: customer.phone });
      setOpen(false);
      setShowCreateForm(false);
    } catch (error) {
      setFormError(getErrorMessage(error, t('customers.errors.saveFailed')));
    }
  }

  return (
    <div className="relative">
      <label className="mb-1.5 block text-[12px] font-medium text-muted">
        {t('pos.customer')}
      </label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 text-left text-[14px] transition-colors hover:border-primary"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedCustomer ? (
            <UserRound size={16} className="shrink-0 text-primary" />
          ) : (
            <Users size={16} className="shrink-0 text-muted" />
          )}
          <span className="truncate">
            {selectedCustomer ? selectedCustomer.name : t('pos.walkInCustomer')}
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      {selectedCustomer ? (
        <button
          type="button"
          onClick={handleSelectWalkIn}
          className="mt-1 text-[12px] text-primary hover:underline"
        >
          {t('pos.clearCustomer')}
        </button>
      ) : null}
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setShowCreateForm(false);
            }}
            aria-label={t('pos.close')}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
            {showCreateForm ? (
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[14px] font-semibold">{t('pos.quickAddCustomer')}</p>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="text-muted hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>
                <CustomerForm
                  compact
                  onSubmit={handleQuickCreate}
                  onCancel={() => setShowCreateForm(false)}
                  isSubmitting={isCreating}
                  submitLabel={t('customers.form.create')}
                  errorMessage={formError}
                />
              </div>
            ) : (
              <>
                <div className="border-b border-border p-3">
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder={t('pos.customerSearchPlaceholder')}
                      className="h-9 pl-9 text-[13px]"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-2">
                  <button
                    type="button"
                    onClick={handleSelectWalkIn}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-[#f4f4f8]',
                      !selectedCustomer && 'bg-[#eef2ff] text-primary'
                    )}
                  >
                    <Users size={16} />
                    {t('pos.walkInCustomer')}
                  </button>
                  {isFetching ? (
                    <p className="px-3 py-4 text-[12px] text-muted">{t('pos.searching')}</p>
                  ) : customers.length === 0 ? (
                    <p className="px-3 py-4 text-[12px] text-muted">{t('pos.noCustomersFound')}</p>
                  ) : (
                    customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-[#f4f4f8]',
                          selectedCustomer?.id === customer.id && 'bg-[#eef2ff] text-primary'
                        )}
                      >
                        <UserRound size={16} className="mt-0.5 shrink-0" />
                        <span>
                          <span className="block text-[13px] font-medium">{customer.name}</span>
                          {customer.phone ? (
                            <span className="block text-[12px] text-muted">{customer.phone}</span>
                          ) : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {canManage ? (
                  <div className="border-t border-border p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowCreateForm(true)}
                    >
                      <Plus size={15} />
                      {t('pos.quickAddCustomer')}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
