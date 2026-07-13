import { baseApi } from './baseApi';

export const customersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCustomers: builder.query({
      query: (params) => ({
        url: '/customers',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Customer', id })),
              { type: 'Customers', id: 'LIST' },
            ]
          : [{ type: 'Customers', id: 'LIST' }],
    }),
    getCustomer: builder.query({
      query: (customerId) => `/customers/${customerId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, customerId) => [{ type: 'Customer', id: customerId }],
    }),
    createCustomer: builder.mutation({
      query: (body) => ({
        url: '/customers',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }],
    }),
    updateCustomer: builder.mutation({
      query: ({ customerId, body }) => ({
        url: `/customers/${customerId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { customerId }) => [
        { type: 'Customer', id: customerId },
        { type: 'Customers', id: 'LIST' },
      ],
    }),
    deactivateCustomer: builder.mutation({
      query: (customerId) => ({
        url: `/customers/${customerId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, customerId) => [
        { type: 'Customer', id: customerId },
        { type: 'Customers', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeactivateCustomerMutation,
} = customersApi;
