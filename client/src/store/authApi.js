import { baseApi } from './baseApi';
import { getAuthToken } from '../lib/authToken';
import { electronPullCache, hasElectronBridge } from '../lib/electronBridge';

async function pullOfflineCache(token) {
  if (!hasElectronBridge() || !token) {
    return;
  }
  try {
    await electronPullCache(token);
  } catch {
    return;
  }
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: ['Session'],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          await pullOfflineCache(data?.token);
        } catch {
          return;
        }
      },
    }),
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: ['Session'],
    }),
    getSession: builder.query({
      query: () => '/auth/session',
      transformResponse: (response) => response.data,
      providesTags: ['Session'],
      async onCacheEntryAdded(_arg, { cacheDataLoaded }) {
        try {
          await cacheDataLoaded;
          await pullOfflineCache(getAuthToken());
        } catch {
          return;
        }
      },
    }),
    unlockSession: builder.mutation({
      query: (body) => ({
        url: '/auth/unlock',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetSessionQuery,
  useUnlockSessionMutation,
} = authApi;
