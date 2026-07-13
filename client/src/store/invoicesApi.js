import { baseApi } from './baseApi';

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoicePayload: builder.query({
      query: (saleId) => `/invoices/${saleId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, saleId) => [{ type: 'Invoice', id: saleId }],
    }),
    getInvoicePdf: builder.mutation({
      query: ({ saleId, format = 'thermal' }) => ({
        url: `/invoices/${saleId}/pdf`,
        params: { format },
        responseHandler: async (response) => {
          const blob = await response.blob();
          return {
            blob,
            invoiceNumber: response.headers.get('X-Invoice-Number'),
            format: response.headers.get('X-Invoice-Format') || format,
          };
        },
      }),
      transformResponse: (response) => response,
    }),
    createInvoicePrintLog: builder.mutation({
      query: ({ saleId, format, status, errorMessage }) => ({
        url: `/invoices/${saleId}/print-logs`,
        method: 'POST',
        body: { format, status, errorMessage },
      }),
      transformResponse: (response) => response.data,
    }),
    listInvoicePrintLogs: builder.query({
      query: (saleId) => `/invoices/${saleId}/print-logs`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, saleId) => [{ type: 'InvoicePrintLogs', id: saleId }],
    }),
  }),
});

export const {
  useGetInvoicePayloadQuery,
  useGetInvoicePdfMutation,
  useCreateInvoicePrintLogMutation,
  useListInvoicePrintLogsQuery,
} = invoicesApi;
