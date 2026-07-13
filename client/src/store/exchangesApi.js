import { baseApi } from './baseApi';

export const exchangesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    lookupSaleForExchange: builder.query({
      query: (params) => ({
        url: '/exchanges/lookup-sale',
        params,
      }),
      transformResponse: (response) => response.data,
    }),
    getEligibleSale: builder.query({
      query: (saleId) => `/exchanges/sales/${saleId}/eligible`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, saleId) => [{ type: 'EligibleSale', id: saleId }],
    }),
    previewExchange: builder.mutation({
      query: (body) => ({
        url: '/exchanges/preview',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
    }),
    createExchange: builder.mutation({
      query: (body) => ({
        url: '/exchanges',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result) => [
        { type: 'Exchanges', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'StockMovements', id: 'LIST' },
        ...(result?.originalSale?.id
          ? [{ type: 'EligibleSale', id: result.originalSale.id }]
          : []),
      ],
    }),
    listExchanges: builder.query({
      query: (params) => ({
        url: '/exchanges',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Exchange', id })),
              { type: 'Exchanges', id: 'LIST' },
            ]
          : [{ type: 'Exchanges', id: 'LIST' }],
    }),
    getExchange: builder.query({
      query: (id) => `/exchanges/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'Exchange', id }],
    }),
  }),
});

export const {
  useLazyLookupSaleForExchangeQuery,
  useGetEligibleSaleQuery,
  usePreviewExchangeMutation,
  useCreateExchangeMutation,
  useListExchangesQuery,
  useGetExchangeQuery,
} = exchangesApi;
