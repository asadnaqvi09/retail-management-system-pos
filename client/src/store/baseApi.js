import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAuthToken, clearAuthToken } from '../lib/authToken';
import { getConnectivitySnapshot } from '../lib/connectivity';
import { electronIsOnline } from '../lib/electronBridge';
import { isNetworkFailure, tryOfflineRead, tryOfflineWrite } from '../lib/offlineHandlers';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  prepareHeaders: (headers) => {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

function isMutationRequest(args) {
  if (typeof args === 'string') {
    return false;
  }
  const method = (args.method || 'GET').toUpperCase();
  return method !== 'GET';
}

async function resolveOnlineState() {
  if (getConnectivitySnapshot() === false) {
    return false;
  }
  return electronIsOnline();
}

async function baseQueryWithAuth(args, api, extraOptions) {
  const online = await resolveOnlineState();
  const mutation = isMutationRequest(args);

  if (!online) {
    if (mutation) {
      const offlineWrite = await tryOfflineWrite(args);
      if (offlineWrite) {
        return offlineWrite;
      }
      return {
        error: {
          status: 'OFFLINE',
          data: { success: false, error: 'This action is not available offline' },
        },
      };
    }
    const offlineRead = await tryOfflineRead(args);
    if (offlineRead) {
      return offlineRead;
    }
    return {
      error: {
        status: 'OFFLINE',
        data: { success: false, error: 'No cached data available offline' },
      },
    };
  }

  const result = await baseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    clearAuthToken();
    return result;
  }
  if (isNetworkFailure(result)) {
    if (mutation) {
      const offlineWrite = await tryOfflineWrite(args);
      if (offlineWrite) {
        return offlineWrite;
      }
    } else {
      const offlineRead = await tryOfflineRead(args);
      if (offlineRead) {
        return offlineRead;
      }
    }
  }
  return result;
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Session', 'Products', 'Product', 'Categories', 'Category', 'CategoryTree', 'Brands', 'Brand', 'Variants', 'Variant', 'VariantMatrix', 'Inventory', 'InventoryItem', 'StockMovements', 'Sales', 'Sale', 'HoldCarts', 'CashRegisterSession', 'Customers', 'Customer', 'Invoice', 'InvoicePrintLogs', 'Exchanges', 'Exchange', 'EligibleSale', 'Expenses', 'Expense', 'ExpenseCategories', 'ExpenseSummary', 'Reports', 'Dashboard', 'Promotions', 'BarcodeLabels', 'Settings', 'SettingsUsers', 'SettingsRoles', 'Backups', 'WhatsappSummaries'],
  endpoints: () => ({}),
});
