import { create } from 'zustand';

export const useAppStore = create((set) => ({
  isOnline: navigator.onLine,
  setOnline: (isOnline) => set({ isOnline }),
}));
