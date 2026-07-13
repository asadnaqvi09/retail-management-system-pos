import { baseApi } from './baseApi';

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query({
      query: (params) => ({
        url: '/products',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Product', id })),
              { type: 'Products', id: 'LIST' },
            ]
          : [{ type: 'Products', id: 'LIST' }],
    }),
    getProduct: builder.query({
      query: (productId) => `/products/${productId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, productId) => [{ type: 'Product', id: productId }],
    }),
    createProduct: builder.mutation({
      query: (body) => ({
        url: '/products',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    updateProduct: builder.mutation({
      query: ({ productId, body }) => ({
        url: `/products/${productId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { productId }) => [
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    archiveProduct: builder.mutation({
      query: (productId) => ({
        url: `/products/${productId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, productId) => [
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    uploadProductImages: builder.mutation({
      query: ({ productId, files }) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));
        return {
          url: `/products/${productId}/images`,
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { productId }) => [
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    removeProductImage: builder.mutation({
      query: ({ productId, imageId }) => ({
        url: `/products/${productId}/images/${imageId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { productId }) => [
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    setPrimaryProductImage: builder.mutation({
      query: ({ productId, imageId }) => ({
        url: `/products/${productId}/images/${imageId}/primary`,
        method: 'PATCH',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { productId }) => [
        { type: 'Product', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    importProducts: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: '/products/import',
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    exportProducts: builder.mutation({
      query: (params) => ({
        url: '/products/export',
        params,
        responseHandler: (response) => response.blob(),
        cache: 'no-cache',
      }),
    }),
  }),
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useArchiveProductMutation,
  useUploadProductImagesMutation,
  useRemoveProductImageMutation,
  useSetPrimaryProductImageMutation,
  useImportProductsMutation,
  useExportProductsMutation,
} = productsApi;
