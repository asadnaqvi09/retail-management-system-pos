import { baseApi } from './baseApi';

export const salesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    lookupVariant: builder.mutation({
      query: (code) => ({
        url: '/sales/lookup-variant',
        method: 'POST',
        body: { code },
      }),
      transformResponse: (response) => response.data,
    }),
    previewSale: builder.mutation({
      query: (body) => ({
        url: '/sales/preview',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
    }),
    createSale: builder.mutation({
      query: (body) => ({
        url: '/sales',
        method: 'POST',
        body: { ...body, clientRequestId: crypto.randomUUID() },
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'HoldCarts', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'StockMovements', id: 'LIST' },
        { type: 'CashRegisterSession', id: 'CURRENT' },
      ],
    }),
    listSales: builder.query({
      query: (params) => ({
        url: '/sales',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Sale', id })),
              { type: 'Sales', id: 'LIST' },
            ]
          : [{ type: 'Sales', id: 'LIST' }],
    }),
    getSale: builder.query({
      query: (id) => `/sales/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'Sale', id }],
    }),
    voidSale: builder.mutation({
      query: (id) => ({
        url: `/sales/${id}/void`,
        method: 'POST',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, id) => [
        { type: 'Sale', id },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'StockMovements', id: 'LIST' },
        { type: 'CashRegisterSession', id: 'CURRENT' },
      ],
    }),
    listHoldCarts: builder.query({
      query: () => '/sales/hold-carts',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'HoldCarts', id: 'LIST' }],
    }),
    createHoldCart: builder.mutation({
      query: (body) => ({
        url: '/sales/hold-carts',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'HoldCarts', id: 'LIST' }],
    }),
    resumeHoldCart: builder.mutation({
      query: (id) => ({
        url: `/sales/hold-carts/${id}/resume`,
        method: 'POST',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'HoldCarts', id: 'LIST' }],
    }),
    cancelHoldCart: builder.mutation({
      query: (id) => ({
        url: `/sales/hold-carts/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'HoldCarts', id: 'LIST' }],
    }),
  }),
});

export const {
  useLookupVariantMutation,
  usePreviewSaleMutation,
  useCreateSaleMutation,
  useListSalesQuery,
  useGetSaleQuery,
  useVoidSaleMutation,
  useListHoldCartsQuery,
  useCreateHoldCartMutation,
  useResumeHoldCartMutation,
  useCancelHoldCartMutation,
} = salesApi;
