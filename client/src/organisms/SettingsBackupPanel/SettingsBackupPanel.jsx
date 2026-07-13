import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, HardDriveDownload, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import { downloadBlob } from '../../lib/format';
import { getErrorMessage } from '../../lib/errors';
import {
  useListBackupsQuery,
  useCreateBackupMutation,
  useDownloadBackupMutation,
  useDeleteBackupMutation,
  useRestoreBackupMutation,
} from '../../store/backupApi';

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export default function SettingsBackupPanel({
  backupSettings,
  canManage,
  onSaveSettings,
  isSavingSettings,
}) {
  const { t } = useTranslation();
  const restoreInputRef = useRef(null);
  const [page, setPage] = useState(1);
  const [restoreFile, setRestoreFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const { data, isLoading, isFetching } = useListBackupsQuery(
    { page, limit: 10 },
    { skip: !canManage }
  );
  const [createBackup, { isLoading: isCreating }] = useCreateBackupMutation();
  const [downloadBackup, { isLoading: isDownloading }] = useDownloadBackupMutation();
  const [deleteBackup] = useDeleteBackupMutation();
  const [restoreBackup, { isLoading: isRestoring }] = useRestoreBackupMutation();

  const backups = data?.items ?? [];
  const meta = data?.meta;
  const settings = backupSettings || {
    autoBackupEnabled: false,
    backupTime: '23:00',
    retentionDays: 30,
  };

  async function handleCreateBackup() {
    try {
      await createBackup().unwrap();
      toast.success(t('backup.createSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('backup.errors.createFailed')));
    }
  }

  async function handleDownload(backupId) {
    try {
      const result = await downloadBackup(backupId).unwrap();
      downloadBlob(result.blob, result.filename);
      toast.success(t('backup.downloadSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('backup.errors.downloadFailed')));
    }
  }

  async function handleDelete(backupId) {
    if (!window.confirm(t('backup.deleteConfirm'))) {
      return;
    }
    setDeletingId(backupId);
    try {
      await deleteBackup(backupId).unwrap();
      toast.success(t('backup.deleteSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('backup.errors.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestore(event) {
    event.preventDefault();
    if (!restoreFile) {
      toast.error(t('backup.errors.fileRequired'));
      return;
    }
    if (confirmText !== 'RESTORE') {
      toast.error(t('backup.errors.confirmRequired'));
      return;
    }
    try {
      await restoreBackup({ file: restoreFile, confirmRestore: 'RESTORE' }).unwrap();
      toast.success(t('backup.restoreSuccess'));
      setRestoreFile(null);
      setConfirmText('');
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t('backup.errors.restoreFailed')));
    }
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    onSaveSettings({
      autoBackupEnabled: formData.get('autoBackupEnabled') === 'on',
      backupTime: String(formData.get('backupTime') || '23:00'),
      retentionDays: Number(formData.get('retentionDays') || 30),
    });
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSettingsSubmit}
        className="space-y-4 rounded-xl border border-border bg-white p-5"
      >
        <div>
          <h3 className="text-[15px] font-semibold">{t('backup.settingsTitle')}</h3>
          <p className="mt-1 text-[13px] text-muted">{t('backup.settingsSubtitle')}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="autoBackupEnabled"
            defaultChecked={settings.autoBackupEnabled}
            disabled={!canManage || isSavingSettings}
            className="h-4 w-4 rounded border-border text-primary"
          />
          {t('backup.autoBackupEnabled')}
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('backup.backupTime')}</label>
            <Input
              type="time"
              name="backupTime"
              defaultValue={settings.backupTime}
              disabled={!canManage || isSavingSettings}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('backup.retentionDays')}</label>
            <Input
              type="number"
              name="retentionDays"
              min="1"
              max="365"
              defaultValue={settings.retentionDays}
              disabled={!canManage || isSavingSettings}
            />
          </div>
        </div>
        {canManage ? (
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={isSavingSettings}>
              {isSavingSettings ? t('settings.saving') : t('backup.saveSettings')}
            </Button>
          </div>
        ) : null}
      </form>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">{t('backup.historyTitle')}</h3>
            <p className="mt-1 text-[13px] text-muted">{t('backup.historySubtitle')}</p>
          </div>
          {canManage ? (
            <Button type="button" onClick={handleCreateBackup} disabled={isCreating}>
              <HardDriveDownload size={16} />
              {isCreating ? t('backup.creating') : t('backup.createNow')}
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-border bg-[#fafafa] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t('backup.table.createdAt')}</th>
                <th className="px-4 py-3 font-medium">{t('backup.table.type')}</th>
                <th className="px-4 py-3 font-medium">{t('backup.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('backup.table.size')}</th>
                {canManage ? <th className="px-4 py-3 font-medium">{t('backup.table.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-muted">
                    {t('backup.loading')}
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-muted">
                    {t('backup.empty')}
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">{formatDateTime(backup.createdAt)}</td>
                    <td className="px-4 py-3 capitalize">{t(`backup.types.${backup.backupType}`)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          backup.status === 'success' ? 'text-success' : 'text-danger'
                        }
                      >
                        {t(`backup.statuses.${backup.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatFileSize(backup.sizeBytes)}</td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={backup.status !== 'success' || isDownloading}
                            onClick={() => handleDownload(backup.id)}
                          >
                            <Download size={14} />
                            {t('backup.download')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === backup.id}
                            onClick={() => handleDelete(backup.id)}
                          >
                            <Trash2 size={14} />
                            {t('backup.delete')}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
            <span>
              {t('promotions.pagination.summary', { page: meta.page, total: meta.totalPages })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || isFetching}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {t('promotions.pagination.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages || isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('promotions.pagination.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <form
          onSubmit={handleRestore}
          className="space-y-4 rounded-xl border border-danger/20 bg-danger/5 p-5"
        >
          <div>
            <h3 className="text-[15px] font-semibold text-danger">{t('backup.restoreTitle')}</h3>
            <p className="mt-1 text-[13px] text-muted">{t('backup.restoreSubtitle')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('backup.restoreFile')}</label>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              disabled={isRestoring}
              onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
              className="block w-full text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('backup.confirmLabel')}</label>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={t('backup.confirmPlaceholder')}
              disabled={isRestoring}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isRestoring}>
              <Upload size={16} />
              {isRestoring ? t('backup.restoring') : t('backup.restoreAction')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
