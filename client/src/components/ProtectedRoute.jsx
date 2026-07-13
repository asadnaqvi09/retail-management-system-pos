import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasAuthToken, clearAuthToken } from '../lib/authToken';
import { useGetSessionQuery } from '../store/authApi';
import AuthLoadingScreen from './AuthLoadingScreen';
import { SessionLockProvider } from '../context/SessionLockContext';
import SessionLockOverlay from '../organisms/SessionLockOverlay';

export default function ProtectedRoute() {
  const location = useLocation();
  const tokenExists = hasAuthToken();
  const { data, isLoading, isError } = useGetSessionQuery(undefined, {
    skip: !tokenExists,
  });

  if (!tokenExists) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isError || !data) {
    clearAuthToken();
    return <Navigate to="/login" replace />;
  }

  return (
    <SessionLockProvider user={data.user}>
      <Outlet />
      <SessionLockOverlay />
    </SessionLockProvider>
  );
}
