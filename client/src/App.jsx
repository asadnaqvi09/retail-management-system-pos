import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import AppLayout from './templates/AppLayout';
import AuthLayout from './templates/AuthLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import BrandsPage from './pages/BrandsPage';
import InventoryPage from './pages/InventoryPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import CustomersPage from './pages/CustomersPage';
import ExchangeReturnPage from './pages/ExchangeReturnPage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SeasonalSalesPage from './pages/SeasonalSalesPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/pos" element={<POSPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/categories" element={<CategoriesPage />} />
            <Route path="/products/brands" element={<BrandsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/sales-history" element={<SalesHistoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/exchanges" element={<ExchangeReturnPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/seasonal" element={<SeasonalSalesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
