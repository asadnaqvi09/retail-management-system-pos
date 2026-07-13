import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import { setAuthToken } from '../lib/authToken';
import { getErrorMessage } from '../lib/errors';
import { useLoginMutation } from '../store/authApi';
import { cn } from '../lib/utils';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const [loginMode, setLoginMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      setFormError(t('auth.errors.usernameRequired'));
      return;
    }
    if (loginMode === 'password' && !password) {
      setFormError(t('auth.errors.passwordRequired'));
      return;
    }
    if (loginMode === 'pin' && !pin) {
      setFormError(t('auth.errors.pinRequired'));
      return;
    }
    try {
      const payload = {
        username: trimmedUsername,
        rememberMe,
        ...(loginMode === 'password' ? { password } : { pin }),
      };
      const result = await login(payload).unwrap();
      setAuthToken(result.token, rememberMe);
      toast.success(t('auth.loginSuccess', { name: result.user.name }));
      const redirectPath = location.state?.from || result.redirectTo || '/';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, t('auth.errors.loginFailed'));
      setFormError(message);
    }
  }

  function switchLoginMode(mode) {
    setLoginMode(mode);
    setFormError('');
    setPassword('');
    setPin('');
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-[0_8px_30px_rgba(15,15,20,0.06)]">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold">{t('auth.welcomeBack')}</h2>
        <p className="mt-1 text-[13px] text-muted">{t('auth.signInSubtitle')}</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-[#f4f4f8] p-1">
        <button
          type="button"
          onClick={() => switchLoginMode('password')}
          className={cn(
            'rounded-md py-2 text-[13px] font-medium transition-colors',
            loginMode === 'password'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          )}
        >
          {t('auth.passwordMode')}
        </button>
        <button
          type="button"
          onClick={() => switchLoginMode('pin')}
          className={cn(
            'rounded-md py-2 text-[13px] font-medium transition-colors',
            loginMode === 'pin'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          )}
        >
          {t('auth.pinMode')}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="mb-1.5 block text-[13px] font-medium">
            {t('auth.username')}
          </label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            placeholder={t('auth.usernamePlaceholder')}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={Boolean(formError)}
            disabled={isLoading}
          />
        </div>
        {loginMode === 'password' ? (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium">
              {t('auth.password')}
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={Boolean(formError)}
              disabled={isLoading}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="pin" className="mb-1.5 block text-[13px] font-medium">
              {t('auth.pin')}
            </label>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t('auth.pinPlaceholder')}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              error={Boolean(formError)}
              disabled={isLoading}
            />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-[13px] text-muted">{t('auth.rememberMe')}</span>
        </label>
        {formError ? (
          <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
            {formError}
          </div>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </div>
  );
}
