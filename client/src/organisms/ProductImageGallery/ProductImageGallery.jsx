import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import Button from '../../atoms/Button';

export default function ProductImageGallery({
  images = [],
  canManage,
  isUploading,
  isRemoving,
  onUpload,
  onRemove,
  onSetPrimary,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onUpload(files);
    }
    event.target.value = '';
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold">{t('products.images.title')}</h3>
          <p className="mt-0.5 text-[12px] text-muted">{t('products.images.subtitle')}</p>
        </div>
        {canManage ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={15} />
              {isUploading ? t('products.images.uploading') : t('products.images.upload')}
            </Button>
          </>
        ) : null}
      </div>
      {!images.length ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-[13px] text-muted">
          {t('products.images.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg border border-border">
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />
              {image.isPrimary ? (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                  {t('products.images.primary')}
                </span>
              ) : null}
              {canManage ? (
                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => onSetPrimary(image.id)}
                      className="flex h-7 flex-1 items-center justify-center rounded-md bg-white/90 text-foreground"
                      title={t('products.images.setPrimary')}
                    >
                      <Star size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    disabled={isRemoving}
                    className="flex h-7 flex-1 items-center justify-center rounded-md bg-white/90 text-danger"
                    title={t('products.images.remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
