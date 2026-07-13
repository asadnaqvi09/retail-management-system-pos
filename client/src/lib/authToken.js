const STORAGE_KEY = 'auth_token';

let memoryToken = localStorage.getItem(STORAGE_KEY) || null;

export function getAuthToken() {
  return memoryToken;
}

export function setAuthToken(token, rememberMe = false) {
  memoryToken = token;
  if (rememberMe) {
    localStorage.setItem(STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

export function clearAuthToken() {
  memoryToken = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAuthToken() {
  return Boolean(memoryToken);
}
