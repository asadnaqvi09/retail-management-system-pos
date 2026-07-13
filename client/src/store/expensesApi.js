import { baseApi } from './baseApi';

function getServerBaseUrl() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
  return apiBase.replace(/\/api\/v1\/?$/, '');
}

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listExpenses: builder.query({
      query: (params) => ({
        url: '/expenses',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Expense', id })),
              { type: 'Expenses', id: 'LIST' },
            ]
          : [{ type: 'Expenses', id: 'LIST' }],
    }),
    getExpense: builder.query({
      query: (id) => `/expenses/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'Expense', id }],
    }),
    getMonthlyExpenseSummary: builder.query({
      query: (params) => ({
        url: '/expenses/summary/monthly',
        params,
      }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'ExpenseSummary', id: 'MONTHLY' }],
    }),
    createExpense: builder.mutation({
      query: (body) => ({
        url: '/expenses',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'Expenses', id: 'LIST' },
        { type: 'ExpenseSummary', id: 'MONTHLY' },
        { type: 'ExpenseCategories', id: 'LIST' },
      ],
    }),
    updateExpense: builder.mutation({
      query: ({ expenseId, body }) => ({
        url: `/expenses/${expenseId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { expenseId }) => [
        { type: 'Expense', id: expenseId },
        { type: 'Expenses', id: 'LIST' },
        { type: 'ExpenseSummary', id: 'MONTHLY' },
        { type: 'ExpenseCategories', id: 'LIST' },
      ],
    }),
    deleteExpense: builder.mutation({
      query: (expenseId) => ({
        url: `/expenses/${expenseId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, expenseId) => [
        { type: 'Expense', id: expenseId },
        { type: 'Expenses', id: 'LIST' },
        { type: 'ExpenseSummary', id: 'MONTHLY' },
        { type: 'ExpenseCategories', id: 'LIST' },
      ],
    }),
    uploadExpenseReceipt: builder.mutation({
      query: ({ expenseId, file }) => {
        const formData = new FormData();
        formData.append('receipt', file);
        return {
          url: `/expenses/${expenseId}/receipt`,
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { expenseId }) => [
        { type: 'Expense', id: expenseId },
        { type: 'Expenses', id: 'LIST' },
      ],
    }),
    listExpenseCategories: builder.query({
      query: () => '/expense-categories',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'ExpenseCategories', id: 'LIST' }],
    }),
    createExpenseCategory: builder.mutation({
      query: (body) => ({
        url: '/expense-categories',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'ExpenseCategories', id: 'LIST' }],
    }),
    updateExpenseCategory: builder.mutation({
      query: ({ categoryId, body }) => ({
        url: `/expense-categories/${categoryId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'ExpenseCategories', id: 'LIST' }],
    }),
  }),
});

export function getExpenseReceiptUrl(attachmentPath) {
  if (!attachmentPath) {
    return null;
  }
  if (attachmentPath.startsWith('http')) {
    return attachmentPath;
  }
  return `${getServerBaseUrl()}${attachmentPath}`;
}

export const {
  useListExpensesQuery,
  useGetExpenseQuery,
  useGetMonthlyExpenseSummaryQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useUploadExpenseReceiptMutation,
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
} = expensesApi;
