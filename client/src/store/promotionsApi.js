import { baseApi } from './baseApi';

export const promotionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPromotions: builder.query({
      query: (params) => ({
        url: '/promotions',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Promotions', id })),
              { type: 'Promotions', id: 'LIST' },
            ]
          : [{ type: 'Promotions', id: 'LIST' }],
    }),
    getPromotion: builder.query({
      query: (promotionId) => `/promotions/${promotionId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, promotionId) => [{ type: 'Promotions', id: promotionId }],
    }),
    createPromotion: builder.mutation({
      query: (body) => ({
        url: '/promotions',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Promotions', id: 'LIST' }, { type: 'Sales', id: 'LIST' }],
    }),
    updatePromotion: builder.mutation({
      query: ({ promotionId, body }) => ({
        url: `/promotions/${promotionId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { promotionId }) => [
        { type: 'Promotions', id: promotionId },
        { type: 'Promotions', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
      ],
    }),
    deletePromotion: builder.mutation({
      query: (promotionId) => ({
        url: `/promotions/${promotionId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Promotions', id: 'LIST' }, { type: 'Sales', id: 'LIST' }],
    }),
  }),
});

export const {
  useListPromotionsQuery,
  useGetPromotionQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useDeletePromotionMutation,
} = promotionsApi;
