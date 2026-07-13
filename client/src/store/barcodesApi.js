import { baseApi } from './baseApi';

export const barcodesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVariantLabel: builder.query({
      query: (variantId) => `/labels/${variantId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, variantId) => [{ type: 'BarcodeLabels', id: variantId }],
    }),
    getVariantLabelPdf: builder.mutation({
      query: ({ variantId, template = '40x30', copies = 1 }) => ({
        url: `/labels/${variantId}/pdf`,
        params: { template, copies },
        responseHandler: async (response) => {
          const blob = await response.blob();
          return {
            blob,
            template: response.headers.get('X-Label-Template') || template,
            labelCount: Number(response.headers.get('X-Label-Count') || copies),
          };
        },
      }),
      transformResponse: (response) => response,
    }),
    printBulkLabels: builder.mutation({
      query: ({ template = '40x30', items }) => ({
        url: '/labels/bulk',
        method: 'POST',
        body: { template, items },
        responseHandler: async (response) => {
          const blob = await response.blob();
          return {
            blob,
            template: response.headers.get('X-Label-Template') || template,
            labelCount: Number(response.headers.get('X-Label-Count') || items.length),
          };
        },
      }),
      transformResponse: (response) => response,
    }),
  }),
});

export const {
  useGetVariantLabelQuery,
  useGetVariantLabelPdfMutation,
  usePrintBulkLabelsMutation,
} = barcodesApi;
