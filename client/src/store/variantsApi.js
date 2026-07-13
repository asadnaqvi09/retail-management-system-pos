import { baseApi } from './baseApi';

export const variantsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVariantAttributes: builder.query({
      query: () => '/variants/attributes',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'VariantMatrix', id: 'ATTRIBUTES' }],
    }),
    listProductVariants: builder.query({
      query: (productId) => `/variants/product/${productId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, productId) => [
        { type: 'Variants', id: productId },
        ...(result || []).map(({ id }) => ({ type: 'Variant', id })),
      ],
    }),
    generateVariantMatrix: builder.mutation({
      query: ({ productId, body }) => ({
        url: `/variants/product/${productId}/generate`,
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { productId }) => [
        { type: 'Variants', id: productId },
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    updateVariant: builder.mutation({
      query: ({ variantId, body, productId }) => ({
        url: `/variants/${variantId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { variantId, productId }) => [
        { type: 'Variant', id: variantId },
        { type: 'Variants', id: productId },
        { type: 'Product', id: productId },
      ],
    }),
    deactivateVariant: builder.mutation({
      query: ({ variantId, productId }) => ({
        url: `/variants/${variantId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { variantId, productId }) => [
        { type: 'Variant', id: variantId },
        { type: 'Variants', id: productId },
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetVariantAttributesQuery,
  useListProductVariantsQuery,
  useGenerateVariantMatrixMutation,
  useUpdateVariantMutation,
  useDeactivateVariantMutation,
} = variantsApi;
