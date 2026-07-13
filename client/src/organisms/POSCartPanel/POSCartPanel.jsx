import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import Input from '../../atoms/Input';
import POSCartItem from '../../molecules/POSCartItem';
import POSCustomerPicker from '../../molecules/POSCustomerPicker';

export default function POSCartPanel({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  isSearching,
  searchInputRef,
  cartLines,
  onIncrease,
  onDecrease,
  onRemove,
  saleLabel,
  selectedCustomer,
  onCustomerSelect,
  canManageCustomers,
  canPickCustomers = true,
}) {
  const { t } = useTranslation();

  function handleSubmit(event) {
    event.preventDefault();
    onSearchSubmit();
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-[16px] font-semibold">{t('pos.newSale')}</h2>
        {saleLabel ? (
          <span className="text-[12px] font-medium text-muted">{saleLabel}</span>
        ) : null}
      </div>
      <div className="space-y-3 border-b border-border px-5 py-4">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('pos.searchPlaceholder')}
              className="h-11 pl-9 text-[14px]"
              autoFocus
            />
          </div>
        </form>
        {canPickCustomers ? (
          <POSCustomerPicker
            selectedCustomer={selectedCustomer}
            onSelect={onCustomerSelect}
            canManage={canManageCustomers}
          />
        ) : (
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted">
              {t('pos.customer')}
            </label>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-[#fafafa] px-3 text-[14px] text-muted">
              <span>{t('pos.walkInCustomer')}</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-2">
        {cartLines.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <p className="text-[14px] font-medium text-muted">{t('pos.emptyCartTitle')}</p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
              {t('pos.emptyCartSubtitle')}
            </p>
          </div>
        ) : (
          cartLines.map((item) => (
            <POSCartItem
              key={item.variantId}
              item={item}
              onIncrease={() => onIncrease(item.variantId)}
              onDecrease={() => onDecrease(item.variantId)}
              onRemove={() => onRemove(item.variantId)}
            />
          ))
        )}
      </div>
      {isSearching ? (
        <div className="border-t border-border px-5 py-2 text-[12px] text-muted">
          {t('pos.searching')}
        </div>
      ) : null}
    </section>
  );
}
