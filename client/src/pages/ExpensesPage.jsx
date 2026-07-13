import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import ExpenseForm from '../organisms/ExpenseForm';
import ExpensesTable from '../organisms/ExpensesTable';
import { useAuth } from '../hooks/useAuth';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useListExpensesQuery,
  useGetMonthlyExpenseSummaryQuery,
  useListExpenseCategoriesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useUploadExpenseReceiptMutation,
  useCreateExpenseCategoryMutation,
  getExpenseReceiptUrl,
} from '../store/expensesApi';

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission('expenses.view');
  const canManage = hasPermission('expenses.manage');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    [page, search, categoryFilter, dateFrom, dateTo]
  );
  const summaryParams = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    [dateFrom, dateTo]
  );

  const { data, isLoading, isFetching, error } = useListExpensesQuery(queryParams, {
    skip: !canView,
  });
  const { data: summary } = useGetMonthlyExpenseSummaryQuery(summaryParams, { skip: !canView });
  const { data: categories = [] } = useListExpenseCategoriesQuery(undefined, { skip: !canView });
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [uploadReceipt, { isLoading: isUploading }] = useUploadExpenseReceiptMutation();
  const [createCategory, { isLoading: isCreatingCategory }] = useCreateExpenseCategoryMutation();

  const expenses = data?.items ?? [];
  const meta = data?.meta;
  const isSubmitting = isCreating || isUpdating || isUploading;

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingExpense(null);
    setReceiptFile(null);
    setFormMode('create');
  }

  function openEditForm(expense) {
    setFormError('');
    setEditingExpense(expense);
    setReceiptFile(null);
    setFormMode('edit');
  }

  function closeForm() {
    setFormError('');
    setEditingExpense(null);
    setReceiptFile(null);
    setFormMode(null);
  }

  async function handleSubmit(values) {
    setFormError('');
    const { receiptFile: file, ...payload } = values;
    try {
      if (formMode === 'create') {
        const created = await createExpense(payload).unwrap();
        if (file) {
          await uploadReceipt({ expenseId: created.id, file }).unwrap();
        }
        toast.success(t('expenses.createSuccess'));
      } else if (editingExpense) {
        await updateExpense({ expenseId: editingExpense.id, body: payload }).unwrap();
        if (file) {
          await uploadReceipt({ expenseId: editingExpense.id, file }).unwrap();
        }
        toast.success(t('expenses.updateSuccess'));
      }
      closeForm();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, t('expenses.errors.saveFailed')));
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(t('expenses.deleteConfirm'))) {
      return;
    }
    try {
      setDeletingId(expense.id);
      await deleteExpense(expense.id).unwrap();
      toast.success(t('expenses.deleteSuccess'));
      if (editingExpense?.id === expense.id) {
        closeForm();
      }
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, t('expenses.errors.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) {
      return;
    }
    try {
      await createCategory({ name }).unwrap();
      setCategoryName('');
      toast.success(t('expenses.categoryCreateSuccess'));
    } catch (categoryError) {
      toast.error(getErrorMessage(categoryError, t('expenses.errors.categoryFailed')));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('expenses.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('expenses.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={openCreateForm}>
            <Plus size={16} />
            {t('expenses.addExpense')}
          </Button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-4 text-[15px] font-semibold">{t('expenses.summary.title')}</h2>
          {summary?.months?.length ? (
            <div className="space-y-4">
              {summary.months.slice(0, 3).map((month) => (
                <div key={month.month} className="rounded-lg bg-background p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{month.month}</p>
                    <p className="font-semibold text-primary">{formatMoney(month.totalAmount)}</p>
                  </div>
                  <div className="space-y-1">
                    {month.categories.map((category) => (
                      <div
                        key={`${month.month}-${category.categoryId}`}
                        className="flex justify-between text-[12px] text-muted-foreground"
                      >
                        <span>{category.categoryName}</span>
                        <span>{formatMoney(category.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t('expenses.summary.empty')}</p>
          )}
          {summary?.grandTotal > 0 ? (
            <p className="mt-4 text-[13px] font-medium">
              {t('expenses.summary.filteredTotal')}: {formatMoney(summary.grandTotal)}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <div className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-4 text-[15px] font-semibold">{t('expenses.categories.title')}</h2>
            <form onSubmit={handleCreateCategory} className="mb-4 flex gap-2">
              <Input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder={t('expenses.categories.placeholder')}
                disabled={isCreatingCategory}
              />
              <Button type="submit" disabled={isCreatingCategory}>
                {t('expenses.categories.add')}
              </Button>
            </form>
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]"
                >
                  <span className={cn(!category.isActive && 'text-muted-foreground line-through')}>
                    {category.name}
                    {category.isSystem ? (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        ({t('expenses.categories.system')})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">{formatMoney(category.totalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearchSubmit} className="flex min-w-[220px] flex-1 gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('expenses.searchPlaceholder')}
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            {t('expenses.search')}
          </Button>
        </form>
        <select
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border px-3 text-[13px]"
        >
          <option value="">{t('expenses.filters.allCategories')}</option>
          {categories
            .filter((category) => category.isActive)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          className="h-10 w-[150px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          className="h-10 w-[150px]"
        />
      </div>

      {meta?.filteredTotal > 0 ? (
        <p className="mb-3 text-[13px] text-muted-foreground">
          {t('expenses.listTotal', { amount: formatMoney(meta.filteredTotal) })}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t('expenses.loading')}</p>
      ) : error ? (
        <p className="text-[13px] text-danger">{getErrorMessage(error, t('expenses.errors.loadFailed'))}</p>
      ) : (
        <ExpensesTable
          expenses={expenses}
          canManage={canManage}
          onEdit={openEditForm}
          onDelete={handleDelete}
          isDeletingId={deletingId}
        />
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <p className="text-muted-foreground">
            {t('expenses.pagination.summary', {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={meta.page <= 1 || isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('expenses.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              disabled={meta.page >= meta.totalPages || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('expenses.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {formMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <button
              type="button"
              onClick={closeForm}
              className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-background"
            >
              <X size={18} />
            </button>
            <ExpenseForm
              categories={categories}
              initialValues={
                editingExpense
                  ? {
                      categoryId: editingExpense.category.id,
                      amount: editingExpense.amount,
                      expenseDate: editingExpense.expenseDate,
                      paymentMethod: editingExpense.paymentMethod,
                      note: editingExpense.note || '',
                    }
                  : undefined
              }
              onSubmit={handleSubmit}
              onCancel={closeForm}
              isSubmitting={isSubmitting}
              submitLabel={
                formMode === 'create' ? t('expenses.form.create') : t('expenses.form.save')
              }
              errorMessage={formError}
              receiptFile={receiptFile}
              onReceiptChange={setReceiptFile}
              existingReceiptUrl={
                editingExpense ? getExpenseReceiptUrl(editingExpense.attachmentPath) : null
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
