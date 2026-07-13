import { baseApi } from './baseApi';

function reportQuery(endpoint, params) {
  return {
    url: `/reports/${endpoint}`,
    params,
  };
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalesReport: builder.query({
      query: (params) => reportQuery('sales', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'sales' }],
    }),
    getRevenueReport: builder.query({
      query: (params) => reportQuery('revenue', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'revenue' }],
    }),
    getProfitReport: builder.query({
      query: (params) => reportQuery('profit', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'profit' }],
    }),
    getInventoryReport: builder.query({
      query: (params) => reportQuery('inventory', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'inventory' }],
    }),
    getTopSellingReport: builder.query({
      query: (params) => reportQuery('top-selling', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'top-selling' }],
    }),
    getLowSellingReport: builder.query({
      query: (params) => reportQuery('low-selling', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'low-selling' }],
    }),
    getCashierPerformanceReport: builder.query({
      query: (params) => reportQuery('cashier-performance', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'cashier-performance' }],
    }),
    getReturnsReport: builder.query({
      query: (params) => reportQuery('returns', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'returns' }],
    }),
    getExchangesReport: builder.query({
      query: (params) => reportQuery('exchanges', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'exchanges' }],
    }),
    getPaymentMethodsReport: builder.query({
      query: (params) => reportQuery('payment-methods', params),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Reports', id: 'payment-methods' }],
    }),
    exportReport: builder.mutation({
      query: ({ reportKey, format, params }) => ({
        url: `/reports/${reportKey}/export`,
        params: { ...params, format },
        responseHandler: async (response) => {
          const blob = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          const match = disposition.match(/filename="(.+)"/);
          return {
            blob,
            filename: match?.[1] || `${reportKey}.${format}`,
          };
        },
      }),
      transformResponse: (response) => response,
    }),
  }),
});

export const {
  useGetSalesReportQuery,
  useGetRevenueReportQuery,
  useGetProfitReportQuery,
  useGetInventoryReportQuery,
  useGetTopSellingReportQuery,
  useGetLowSellingReportQuery,
  useGetCashierPerformanceReportQuery,
  useGetReturnsReportQuery,
  useGetExchangesReportQuery,
  useGetPaymentMethodsReportQuery,
  useExportReportMutation,
} = reportsApi;
