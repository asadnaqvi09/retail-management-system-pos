import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-sm">
            Z
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('app.tagline')}</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
