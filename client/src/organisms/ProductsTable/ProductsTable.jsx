import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import ProductStatusBadge from '../../molecules/ProductStatusBadge';
import { formatCurrency } from '../../lib/format';

export default function ProductsTable({ products, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <Package size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('products.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('products.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t('products.table.product')}</th>
            <th className="px-4 py-3">{t('products.table.sku')}</th>
            <th className="px-4 py-3">{t('products.table.category')}</th>
            <th className="px-4 py-3">{t('products.table.price')}</th>
            <th className="px-4 py-3">{t('products.table.variants')}</th>
            <th className="px-4 py-3">{t('products.table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-border last:border-b-0 hover:bg-[#fafafa]">
              <td className="px-4 py-3">
                <Link to={`/products/${product.id}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f4f8]">
                    {product.primaryImage?.url ? (
                      <img
                        src={product.primaryImage.url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{product.name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {product.brand?.name || t('products.noBrand')}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{product.baseSku}</td>
              <td className="px-4 py-3 text-[13px] text-muted">
                {product.category?.name || t('products.noCategory')}
              </td>
              <td className="px-4 py-3 text-[13px] font-medium tabular-nums">
                {formatCurrency(product.defaultSellingPrice)}
              </td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{product.variantCount}</td>
              <td className="px-4 py-3">
                <ProductStatusBadge status={product.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
