import { Navigate, Outlet } from 'react-router-dom';
import { hasAuthToken } from '../lib/authToken';
import { useGetSessionQuery } from '../store/authApi';
import AuthLoadingScreen from './AuthLoadingScreen';

export default function GuestRoute() {
  const tokenExists = hasAuthToken();
  const { data, isLoading } = useGetSessionQuery(undefined, {
    skip: !tokenExists,
  });

  if (tokenExists && isLoading) {
    return <AuthLoadingScreen />;
  }

  if (tokenExists && data) {
    return <Navigate to={data.redirectTo || '/'} replace />;
  }

  return <Outlet />;
}
