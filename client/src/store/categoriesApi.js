import { baseApi } from './baseApi';

export const categoriesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCategories: builder.query({
      query: (params) => ({
        url: '/categories',
        params,
      }),
      transformResponse: (response) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Category', id })),
              { type: 'Categories', id: 'LIST' },
            ]
          : [{ type: 'Categories', id: 'LIST' }],
    }),
    getCategoryTree: builder.query({
      query: (params) => ({
        url: '/categories/tree',
        params,
      }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'CategoryTree', id: 'TREE' }],
    }),
    getCategory: builder.query({
      query: (categoryId) => `/categories/${categoryId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, categoryId) => [{ type: 'Category', id: categoryId }],
    }),
    createCategory: builder.mutation({
      query: (body) => ({
        url: '/categories',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'Categories', id: 'LIST' },
        { type: 'CategoryTree', id: 'TREE' },
      ],
    }),
    updateCategory: builder.mutation({
      query: ({ categoryId, body }) => ({
        url: `/categories/${categoryId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { categoryId }) => [
        { type: 'Category', id: categoryId },
        { type: 'Categories', id: 'LIST' },
        { type: 'CategoryTree', id: 'TREE' },
      ],
    }),
    deactivateCategory: builder.mutation({
      query: (categoryId) => ({
        url: `/categories/${categoryId}`,
        method: 'DELETE',
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, categoryId) => [
        { type: 'Category', id: categoryId },
        { type: 'Categories', id: 'LIST' },
        { type: 'CategoryTree', id: 'TREE' },
      ],
    }),
  }),
});

export const {
  useListCategoriesQuery,
  useGetCategoryTreeQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeactivateCategoryMutation,
} = categoriesApi;
