import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './baseApi';
import './authApi';
import './productsApi';
import './categoriesApi';
import './brandsApi';
import './variantsApi';
import './inventoryApi';
import './salesApi';
import './cashRegisterApi';
import './customersApi';
import './invoicesApi';
import './exchangesApi';
import './expensesApi';
import './reportsApi';
import './dashboardApi';
import './promotionsApi';
import './barcodesApi';
import './settingsApi';
import './backupApi';
import './whatsappApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

setupListeners(store.dispatch);
