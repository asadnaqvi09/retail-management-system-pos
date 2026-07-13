import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';

export default function BrandsTable({
  brands,
  isLoading,
  canManage,
  onEdit,
  onDeactivate,
  onUploadLogo,
  onRemoveLogo,
  isUploading,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!brands.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <Building2 size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('brands.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('brands.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t('brands.table.brand')}</th>
            <th className="px-4 py-3">{t('brands.table.products')}</th>
            <th className="px-4 py-3">{t('brands.table.status')}</th>
            {canManage ? <th className="px-4 py-3">{t('brands.table.actions')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => (
            <tr key={brand.id} className="border-b border-border last:border-b-0 hover:bg-[#fafafa]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f4f8]">
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{brand.name}</div>
                    {canManage ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <label className="cursor-pointer text-[12px] text-primary hover:underline">
                          {isUploading ? t('brands.logo.uploading') : t('brands.logo.upload')}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              if (file) {
                                onUploadLogo(brand, file);
                              }
                            }}
                          />
                        </label>
                        {brand.logoUrl ? (
                          <button
                            type="button"
                            className="text-[12px] text-danger hover:underline"
                            onClick={() => onRemoveLogo(brand)}
                          >
                            {t('brands.logo.remove')}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{brand.productCount}</td>
              <td className="px-4 py-3">
                {brand.isActive ? (
                  <Badge variant="success">{t('brands.status.active')}</Badge>
                ) : (
                  <Badge variant="warning">{t('brands.status.inactive')}</Badge>
                )}
              </td>
              {canManage ? (
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(brand)}>
                      {t('brands.edit')}
                    </Button>
                    {brand.isActive ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDeactivate(brand)}
                      >
                        {t('brands.deactivate')}
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
