export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.data?.error) return error.data.error;
  if (error.error) return error.error;
  if (error.message) return error.message;
  return fallback;
}
