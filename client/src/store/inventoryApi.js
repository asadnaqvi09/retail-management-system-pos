import { baseApi } from './baseApi';

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInventory: builder.query({
      query: (params) => ({
        url: '/inventory',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ variantId }) => ({ type: 'InventoryItem', id: variantId })),
              { type: 'Inventory', id: 'LIST' },
            ]
          : [{ type: 'Inventory', id: 'LIST' }],
    }),
    getInventoryItem: builder.query({
      query: (variantId) => `/inventory/${variantId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, variantId) => [{ type: 'InventoryItem', id: variantId }],
    }),
    listStockMovements: builder.query({
      query: (params) => ({
        url: '/inventory/movements',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: [{ type: 'StockMovements', id: 'LIST' }],
    }),
    adjustStock: builder.mutation({
      query: ({ variantId, body }) => ({
        url: `/inventory/${variantId}/adjust`,
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { variantId }) => [
        { type: 'InventoryItem', id: variantId },
        { type: 'Inventory', id: 'LIST' },
        { type: 'StockMovements', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),
    updateReorderThreshold: builder.mutation({
      query: ({ variantId, reorderThreshold }) => ({
        url: `/inventory/${variantId}/threshold`,
        method: 'PUT',
        body: { reorderThreshold },
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { variantId }) => [
        { type: 'InventoryItem', id: variantId },
        { type: 'Inventory', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListInventoryQuery,
  useGetInventoryItemQuery,
  useListStockMovementsQuery,
  useAdjustStockMutation,
  useUpdateReorderThresholdMutation,
} = inventoryApi;
