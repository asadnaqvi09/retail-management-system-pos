import { baseApi } from './baseApi';

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query({
      query: () => '/settings',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    updateStore: builder.mutation({
      query: (body) => ({
        url: '/settings/store',
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    uploadStoreLogo: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('logo', file);
        return {
          url: '/settings/store/logo',
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    removeStoreLogo: builder.mutation({
      query: () => ({
        url: '/settings/store/logo',
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    updateSettingsSection: builder.mutation({
      query: ({ section, values }) => ({
        url: `/settings/sections/${section}`,
        method: 'PATCH',
        body: { values },
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    createTaxClass: builder.mutation({
      query: (body) => ({
        url: '/settings/tax-classes',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    updateTaxClass: builder.mutation({
      query: ({ taxClassId, body }) => ({
        url: `/settings/tax-classes/${taxClassId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    deleteTaxClass: builder.mutation({
      query: (taxClassId) => ({
        url: `/settings/tax-classes/${taxClassId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'OVERVIEW' }],
    }),
    getShortcuts: builder.query({
      query: () => '/settings/shortcuts',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Settings', id: 'SHORTCUTS' }],
    }),
    updateShortcuts: builder.mutation({
      query: (shortcuts) => ({
        url: '/settings/shortcuts',
        method: 'PATCH',
        body: { shortcuts },
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Settings', id: 'SHORTCUTS' }, { type: 'Settings', id: 'OVERVIEW' }],
    }),
    listSettingsUsers: builder.query({
      query: (params) => ({
        url: '/settings/users',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'SettingsUsers', id })),
              { type: 'SettingsUsers', id: 'LIST' },
            ]
          : [{ type: 'SettingsUsers', id: 'LIST' }],
    }),
    listSettingsRoles: builder.query({
      query: () => '/settings/roles',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'SettingsRoles', id: 'LIST' }],
    }),
    createSettingsUser: builder.mutation({
      query: (body) => ({
        url: '/settings/users',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'SettingsUsers', id: 'LIST' }],
    }),
    updateSettingsUser: builder.mutation({
      query: ({ userId, body }) => ({
        url: `/settings/users/${userId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { userId }) => [
        { type: 'SettingsUsers', id: userId },
        { type: 'SettingsUsers', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateStoreMutation,
  useUploadStoreLogoMutation,
  useRemoveStoreLogoMutation,
  useUpdateSettingsSectionMutation,
  useCreateTaxClassMutation,
  useUpdateTaxClassMutation,
  useDeleteTaxClassMutation,
  useGetShortcutsQuery,
  useUpdateShortcutsMutation,
  useListSettingsUsersQuery,
  useListSettingsRolesQuery,
  useCreateSettingsUserMutation,
  useUpdateSettingsUserMutation,
} = settingsApi;
