import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import { getErrorMessage } from '../../lib/errors';
import { cn } from '../../lib/utils';
import {
  useListSettingsUsersQuery,
  useListSettingsRolesQuery,
  useCreateSettingsUserMutation,
  useUpdateSettingsUserMutation,
} from '../../store/settingsApi';

const emptyUser = {
  name: '',
  username: '',
  email: '',
  roleId: '',
  authType: 'password',
  password: '',
  pin: '',
  defaultLandingScreen: 'dashboard',
  status: 'active',
};

export default function SettingsUsersPanel({ canManageUsers }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formValues, setFormValues] = useState(emptyUser);
  const [formError, setFormError] = useState('');

  const queryParams = useMemo(
    () => ({ page, limit: 20, search }),
    [page, search]
  );

  const { data, isLoading, isFetching } = useListSettingsUsersQuery(queryParams);
  const { data: roles = [] } = useListSettingsRolesQuery();
  const [createUser, { isLoading: isCreating }] = useCreateSettingsUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateSettingsUserMutation();

  const users = data?.items ?? [];
  const meta = data?.meta;
  const isSubmitting = isCreating || isUpdating;

  useEffect(() => {
    if (roles.length && !formValues.roleId && formMode) {
      setFormValues((current) => ({ ...current, roleId: roles[0].id }));
    }
  }, [roles, formValues.roleId, formMode]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingUser(null);
    setFormValues({
      ...emptyUser,
      roleId: roles[0]?.id || '',
    });
    setFormMode('create');
  }

  function openEditForm(user) {
    setFormError('');
    setEditingUser(user);
    setFormValues({
      name: user.name,
      username: user.username,
      email: user.email || '',
      roleId: user.roleId,
      authType: user.hasPin ? 'pin' : 'password',
      password: '',
      pin: '',
      defaultLandingScreen: user.defaultLandingScreen,
      status: user.status,
    });
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode(null);
    setEditingUser(null);
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManageUsers) {
      return;
    }
    setFormError('');
    const payload = {
      name: formValues.name.trim(),
      username: formValues.username.trim(),
      email: formValues.email.trim() || null,
      roleId: formValues.roleId,
      defaultLandingScreen: formValues.defaultLandingScreen,
      status: formValues.status,
    };
    if (formMode === 'create') {
      if (formValues.authType === 'password') {
        payload.password = formValues.password;
      } else {
        payload.pin = formValues.pin;
      }
    } else if (formValues.password) {
      payload.password = formValues.password;
    } else if (formValues.pin) {
      payload.pin = formValues.pin;
    }
    try {
      if (formMode === 'edit' && editingUser) {
        await updateUser({ userId: editingUser.id, body: payload }).unwrap();
        toast.success(t('settings.users.updateSuccess'));
      } else {
        await createUser(payload).unwrap();
        toast.success(t('settings.users.createSuccess'));
      }
      closeForm();
    } catch (error) {
      const message = getErrorMessage(error, t('settings.errors.saveFailed'));
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">{t('settings.users.title')}</h3>
        {canManageUsers ? (
          <Button type="button" onClick={openCreateForm}>
            <Plus size={16} />
            {t('settings.users.addUser')}
          </Button>
        ) : null}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('settings.users.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          {t('customers.search')}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-b border-border bg-[#fafafa] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('settings.users.name')}</th>
              <th className="px-4 py-3 font-medium">{t('settings.users.username')}</th>
              <th className="px-4 py-3 font-medium">{t('settings.users.role')}</th>
              <th className="px-4 py-3 font-medium">{t('settings.users.status')}</th>
              <th className="px-4 py-3 font-medium">{t('settings.users.landingScreen')}</th>
              {canManageUsers ? (
                <th className="px-4 py-3 font-medium">{t('settings.users.actions')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canManageUsers ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  {t('settings.loading')}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={canManageUsers ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  {t('settings.users.empty')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">{user.roleName}</td>
                  <td className="px-4 py-3 capitalize">{t(`settings.users.${user.status}`)}</td>
                  <td className="px-4 py-3">
                    {t(`settings.users.landing.${user.defaultLandingScreen}`)}
                  </td>
                  {canManageUsers ? (
                    <td className="px-4 py-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(user)}>
                        {t('customers.edit')}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span>
            {t('promotions.pagination.summary', { page: meta.page, total: meta.totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              {t('promotions.pagination.previous')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('promotions.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {formMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-[16px] font-semibold">
                {formMode === 'edit' ? t('settings.users.editUser') : t('settings.users.addUser')}
              </h4>
              <button type="button" onClick={closeForm} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.name')}</label>
                <Input
                  value={formValues.name}
                  onChange={(event) => setFormValues((c) => ({ ...c, name: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.username')}</label>
                <Input
                  value={formValues.username}
                  onChange={(event) => setFormValues((c) => ({ ...c, username: event.target.value }))}
                  required
                  disabled={isSubmitting || formMode === 'edit'}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.email')}</label>
                <Input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((c) => ({ ...c, email: event.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.role')}</label>
                <select
                  value={formValues.roleId}
                  onChange={(event) => setFormValues((c) => ({ ...c, roleId: event.target.value }))}
                  required
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              {formMode === 'create' ? (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.authType')}</label>
                  <select
                    value={formValues.authType}
                    onChange={(event) => setFormValues((c) => ({ ...c, authType: event.target.value }))}
                    disabled={isSubmitting}
                    className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                  >
                    <option value="password">{t('settings.users.passwordAuth')}</option>
                    <option value="pin">{t('settings.users.pinAuth')}</option>
                  </select>
                </div>
              ) : null}
              {formMode === 'create' && formValues.authType === 'password' ? (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.password')}</label>
                  <Input
                    type="password"
                    value={formValues.password}
                    onChange={(event) => setFormValues((c) => ({ ...c, password: event.target.value }))}
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}
              {formMode === 'create' && formValues.authType === 'pin' ? (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.pin')}</label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={formValues.pin}
                    onChange={(event) => setFormValues((c) => ({ ...c, pin: event.target.value }))}
                    required
                    pattern="\d{4,6}"
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}
              {formMode === 'edit' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.password')}</label>
                    <Input
                      type="password"
                      value={formValues.password}
                      onChange={(event) => setFormValues((c) => ({ ...c, password: event.target.value, pin: '' }))}
                      placeholder="••••••"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.pin')}</label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      value={formValues.pin}
                      onChange={(event) => setFormValues((c) => ({ ...c, pin: event.target.value, password: '' }))}
                      placeholder="1234"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.landingScreen')}</label>
                  <select
                    value={formValues.defaultLandingScreen}
                    onChange={(event) =>
                      setFormValues((c) => ({ ...c, defaultLandingScreen: event.target.value }))
                    }
                    disabled={isSubmitting}
                    className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                  >
                    <option value="dashboard">{t('settings.users.landing.dashboard')}</option>
                    <option value="pos">{t('settings.users.landing.pos')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">{t('settings.users.status')}</label>
                  <select
                    value={formValues.status}
                    onChange={(event) => setFormValues((c) => ({ ...c, status: event.target.value }))}
                    disabled={isSubmitting}
                    className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                  >
                    <option value="active">{t('settings.users.active')}</option>
                    <option value="inactive">{t('settings.users.inactive')}</option>
                  </select>
                </div>
              </div>
              {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
                  {t('promotions.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('settings.saving') : t('settings.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
