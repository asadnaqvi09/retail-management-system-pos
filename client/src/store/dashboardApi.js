import { baseApi } from './baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardOverview: builder.query({
      query: (params) => ({
        url: '/dashboard',
        params,
      }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Dashboard', id: 'overview' }],
    }),
  }),
});

export const { useGetDashboardOverviewQuery } = dashboardApi;
