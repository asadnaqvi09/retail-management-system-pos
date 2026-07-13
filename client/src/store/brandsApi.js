import { baseApi } from './baseApi';

export const brandsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listBrands: builder.query({
      query: (params) => ({
        url: '/brands',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Brand', id })),
              { type: 'Brands', id: 'LIST' },
            ]
          : [{ type: 'Brands', id: 'LIST' }],
    }),
    getBrand: builder.query({
      query: (brandId) => `/brands/${brandId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, brandId) => [{ type: 'Brand', id: brandId }],
    }),
    createBrand: builder.mutation({
      query: (body) => ({
        url: '/brands',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Brands', id: 'LIST' }],
    }),
    updateBrand: builder.mutation({
      query: ({ brandId, body }) => ({
        url: `/brands/${brandId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { brandId }) => [
        { type: 'Brand', id: brandId },
        { type: 'Brands', id: 'LIST' },
      ],
    }),
    deactivateBrand: builder.mutation({
      query: (brandId) => ({
        url: `/brands/${brandId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, brandId) => [
        { type: 'Brand', id: brandId },
        { type: 'Brands', id: 'LIST' },
      ],
    }),
    uploadBrandLogo: builder.mutation({
      query: ({ brandId, file }) => {
        const formData = new FormData();
        formData.append('logo', file);
        return {
          url: `/brands/${brandId}/logo`,
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { brandId }) => [
        { type: 'Brand', id: brandId },
        { type: 'Brands', id: 'LIST' },
      ],
    }),
    removeBrandLogo: builder.mutation({
      query: (brandId) => ({
        url: `/brands/${brandId}/logo`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, brandId) => [
        { type: 'Brand', id: brandId },
        { type: 'Brands', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListBrandsQuery,
  useGetBrandQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeactivateBrandMutation,
  useUploadBrandLogoMutation,
  useRemoveBrandLogoMutation,
} = brandsApi;
