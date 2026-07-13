import { baseApi } from './baseApi';

export const whatsappApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listWhatsappSummaries: builder.query({
      query: (params) => ({
        url: '/whatsapp/summaries',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'WhatsappSummaries', id })),
              { type: 'WhatsappSummaries', id: 'LIST' },
            ]
          : [{ type: 'WhatsappSummaries', id: 'LIST' }],
    }),
    previewWhatsappSummary: builder.query({
      query: (params) => ({
        url: '/whatsapp/preview',
        params,
      }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'WhatsappSummaries', id: 'PREVIEW' }],
    }),
    sendWhatsappSummary: builder.mutation({
      query: (body) => ({
        url: '/whatsapp/send',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'WhatsappSummaries', id: 'LIST' }, { type: 'WhatsappSummaries', id: 'PREVIEW' }],
    }),
    sendWhatsappTest: builder.mutation({
      query: (body) => ({
        url: '/whatsapp/test',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useListWhatsappSummariesQuery,
  usePreviewWhatsappSummaryQuery,
  useSendWhatsappSummaryMutation,
  useSendWhatsappTestMutation,
} = whatsappApi;
