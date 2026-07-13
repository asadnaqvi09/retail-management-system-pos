import { baseApi } from './baseApi';

export const cashRegisterApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentSession: builder.query({
      query: () => '/cash-register/current',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'CashRegisterSession', id: 'CURRENT' }],
    }),
    getSession: builder.query({
      query: (id) => `/cash-register/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'CashRegisterSession', id }],
    }),
    openSession: builder.mutation({
      query: (body) => ({
        url: '/cash-register/open',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'CashRegisterSession', id: 'CURRENT' }],
    }),
    closeSession: builder.mutation({
      query: ({ id, body }) => ({
        url: `/cash-register/${id}/close`,
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'CashRegisterSession', id: 'CURRENT' }],
    }),
  }),
});

export const {
  useGetCurrentSessionQuery,
  useGetSessionQuery,
  useOpenSessionMutation,
  useCloseSessionMutation,
} = cashRegisterApi;
