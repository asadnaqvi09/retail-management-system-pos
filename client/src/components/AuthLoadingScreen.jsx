import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export default function AuthLoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-[13px] text-muted">{t('auth.loading')}</p>
      </div>
    </div>
  );
}

export function AuthLoadingInline({ className }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
