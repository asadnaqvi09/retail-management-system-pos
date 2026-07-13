import { useMemo } from 'react';
import { hasAuthToken } from '../lib/authToken';
import {
  useGetSessionQuery,
  useLoginMutation,
  useLogoutMutation,
} from '../store/authApi';

export function useAuth() {
  const tokenExists = hasAuthToken();
  const sessionQuery = useGetSessionQuery(undefined, {
    skip: !tokenExists,
  });
  const [login, loginState] = useLoginMutation();
  const [logout, logoutState] = useLogoutMutation();

  const permissions = sessionQuery.data?.permissions ?? [];

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  return {
    user: sessionQuery.data?.user ?? null,
    role: sessionQuery.data?.role ?? null,
    permissions,
    redirectTo: sessionQuery.data?.redirectTo ?? '/',
    isAuthenticated: Boolean(tokenExists && sessionQuery.data),
    isLoading: tokenExists && sessionQuery.isLoading,
    isFetching: sessionQuery.isFetching,
    sessionError: sessionQuery.error,
    login,
    loginState,
    logout,
    logoutState,
    hasPermission: (key) => permissionSet.has(key),
    hasRole: (roleName) => sessionQuery.data?.role?.name === roleName,
    refetchSession: sessionQuery.refetch,
  };
}
