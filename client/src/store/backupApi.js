import { baseApi } from './baseApi';

export const backupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listBackups: builder.query({
      query: (params) => ({
        url: '/backups',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Backups', id })),
              { type: 'Backups', id: 'LIST' },
            ]
          : [{ type: 'Backups', id: 'LIST' }],
    }),
    createBackup: builder.mutation({
      query: () => ({
        url: '/backups',
        method: 'POST',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Backups', id: 'LIST' }],
    }),
    downloadBackup: builder.mutation({
      query: (backupId) => ({
        url: `/backups/${backupId}/download`,
        responseHandler: async (response) => {
          const blob = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          const match = disposition.match(/filename="(.+)"/);
          return {
            blob,
            filename: match?.[1] || `backup-${backupId}.json`,
          };
        },
      }),
      transformResponse: (response) => response,
    }),
    deleteBackup: builder.mutation({
      query: (backupId) => ({
        url: `/backups/${backupId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Backups', id: 'LIST' }],
    }),
    restoreBackup: builder.mutation({
      query: ({ file, confirmRestore }) => {
        const formData = new FormData();
        formData.append('backup', file);
        formData.append('confirmRestore', confirmRestore);
        return {
          url: '/backups/restore',
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'Backups', id: 'LIST' },
        { type: 'Settings', id: 'OVERVIEW' },
        { type: 'Products', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Dashboard', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListBackupsQuery,
  useCreateBackupMutation,
  useDownloadBackupMutation,
  useDeleteBackupMutation,
  useRestoreBackupMutation,
} = backupApi;
