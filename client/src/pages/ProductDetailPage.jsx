import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Package } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import ProductForm from '../organisms/ProductForm';
import ProductImageGallery from '../organisms/ProductImageGallery';
import VariantMatrixPanel from '../organisms/VariantMatrixPanel';
import ProductStatusBadge from '../molecules/ProductStatusBadge';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency } from '../lib/format';
import { flattenCategoryOptions } from '../lib/categories';
import {
  useArchiveProductMutation,
  useCreateProductMutation,
  useGetProductQuery,
  useRemoveProductImageMutation,
  useSetPrimaryProductImageMutation,
  useUpdateProductMutation,
  useUploadProductImagesMutation,
} from '../store/productsApi';
import { useGetCategoryTreeQuery } from '../store/categoriesApi';
import { useListBrandsQuery } from '../store/brandsApi';

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreateMode = id === 'new';
  const { hasPermission } = useAuth();
  const [formError, setFormError] = useState('');
  const canUpdate = hasPermission('products.update');
  const canCreate = hasPermission('products.create');
  const canDelete = hasPermission('products.delete');
  const canManageVariants = hasPermission('variants.manage');
  const canEdit = isCreateMode ? canCreate : canUpdate;
  const { data: product, isLoading, error } = useGetProductQuery(id, { skip: isCreateMode });
  const { data: categoryTree = [] } = useGetCategoryTreeQuery({ isActive: true });
  const { data: brandList } = useListBrandsQuery({ limit: 100, isActive: true });
  const categoryOptions = useMemo(() => flattenCategoryOptions(categoryTree), [categoryTree]);
  const brandOptions = brandList?.items ?? [];
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [archiveProduct, { isLoading: isArchiving }] = useArchiveProductMutation();
  const [uploadImages, { isLoading: isUploading }] = useUploadProductImagesMutation();
  const [removeImage, { isLoading: isRemoving }] = useRemoveProductImageMutation();
  const [setPrimaryImage] = useSetPrimaryProductImageMutation();

  async function handleSubmit(values) {
    setFormError('');
    try {
      if (isCreateMode) {
        const created = await createProduct(values).unwrap();
        toast.success(t('products.createSuccess'));
        navigate(`/products/${created.id}`, { replace: true });
        return;
      }
      await updateProduct({ productId: id, body: values }).unwrap();
      toast.success(t('products.updateSuccess'));
    } catch (submitError) {
      const message = getErrorMessage(submitError, t('products.errors.saveFailed'));
      setFormError(message);
    }
  }

  async function handleArchive() {
    if (!window.confirm(t('products.archiveConfirm'))) {
      return;
    }
    try {
      await archiveProduct(id).unwrap();
      toast.success(t('products.archiveSuccess'));
      navigate('/products');
    } catch (archiveError) {
      toast.error(getErrorMessage(archiveError, t('products.errors.archiveFailed')));
    }
  }

  async function handleUpload(files) {
    try {
      await uploadImages({ productId: id, files }).unwrap();
      toast.success(t('products.images.uploadSuccess'));
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, t('products.errors.uploadFailed')));
    }
  }

  async function handleRemoveImage(imageId) {
    if (!window.confirm(t('products.images.removeConfirm'))) {
      return;
    }
    try {
      await removeImage({ productId: id, imageId }).unwrap();
      toast.success(t('products.images.removeSuccess'));
    } catch (removeError) {
      toast.error(getErrorMessage(removeError, t('products.errors.removeImageFailed')));
    }
  }

  async function handleSetPrimary(imageId) {
    try {
      await setPrimaryImage({ productId: id, imageId }).unwrap();
      toast.success(t('products.images.primarySuccess'));
    } catch (primaryError) {
      toast.error(getErrorMessage(primaryError, t('products.errors.primaryFailed')));
    }
  }

  if (!isCreateMode && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!isCreateMode && error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <p className="text-[14px] text-danger">{getErrorMessage(error, t('products.errors.loadFailed'))}</p>
        <Link
          to="/products"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-muted transition-colors hover:bg-[#f4f4f8]"
        >
          {t('products.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/products"
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-primary"
          >
            <ArrowLeft size={15} />
            {t('products.backToList')}
          </Link>
          <div className="flex items-center gap-3">
            {!isCreateMode && product?.primaryImage?.url ? (
              <img
                src={product.primaryImage.url}
                alt={product.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#eef2ff] text-primary">
                <Package size={20} />
              </div>
            )}
            <div>
              <h1 className="text-[20px] font-semibold">
                {isCreateMode ? t('products.createTitle') : product.name}
              </h1>
              {!isCreateMode ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <span>{product.baseSku}</span>
                  <ProductStatusBadge status={product.status} />
                  <span>{formatCurrency(product.defaultSellingPrice)}</span>
                </div>
              ) : (
                <p className="mt-0.5 text-[13px] text-muted">{t('products.createSubtitle')}</p>
              )}
            </div>
          </div>
        </div>
        {!isCreateMode && canDelete && product?.status !== 'inactive' ? (
          <Button variant="outline" disabled={isArchiving} onClick={handleArchive}>
            {isArchiving ? t('products.archiving') : t('products.archive')}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-4 text-[15px] font-semibold">
            {isCreateMode ? t('products.form.createHeading') : t('products.form.editHeading')}
          </h2>
          {canEdit ? (
            <ProductForm
              initialValues={
                isCreateMode
                  ? undefined
                  : {
                      name: product.name,
                      description: product.description,
                      baseSku: product.baseSku,
                      defaultSellingPrice: product.defaultSellingPrice,
                      defaultCostPrice: product.defaultCostPrice,
                      status: product.status,
                      categoryId: product.category?.id || '',
                      brandId: product.brand?.id || '',
                    }
              }
              categoryOptions={categoryOptions}
              brandOptions={brandOptions}
              onSubmit={handleSubmit}
              isSubmitting={isCreating || isUpdating}
              submitLabel={isCreateMode ? t('products.form.create') : t('products.form.save')}
              errorMessage={formError}
            />
          ) : (
            <p className="text-[13px] text-muted">{t('products.readOnly')}</p>
          )}
        </div>
        {!isCreateMode ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-5">
              <h3 className="mb-3 text-[15px] font-semibold">{t('products.details.title')}</h3>
              <dl className="space-y-3 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('products.details.category')}</dt>
                  <dd>{product.category?.name || t('products.noCategory')}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('products.details.brand')}</dt>
                  <dd>{product.brand?.name || t('products.noBrand')}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('products.details.variants')}</dt>
                  <dd>{product.variantCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('products.details.costPrice')}</dt>
                  <dd>{formatCurrency(product.defaultCostPrice)}</dd>
                </div>
              </dl>
            </div>
            <ProductImageGallery
              images={product.images}
              canManage={canUpdate}
              isUploading={isUploading}
              isRemoving={isRemoving}
              onUpload={handleUpload}
              onRemove={handleRemoveImage}
              onSetPrimary={handleSetPrimary}
            />
          </div>
        ) : null}
      </div>
      {!isCreateMode ? (
        <div className="mt-6">
          <VariantMatrixPanel productId={id} productName={product.name} canManage={canManageVariants} />
        </div>
      ) : null}
    </div>
  );
}
