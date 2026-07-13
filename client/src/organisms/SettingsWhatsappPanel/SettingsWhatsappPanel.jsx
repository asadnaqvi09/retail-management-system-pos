import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import { getErrorMessage } from '../../lib/errors';
import {
  useListWhatsappSummariesQuery,
  usePreviewWhatsappSummaryQuery,
  useSendWhatsappSummaryMutation,
  useSendWhatsappTestMutation,
} from '../../store/whatsappApi';

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export default function SettingsWhatsappPanel({
  whatsappSettings,
  canManage,
  onSaveSettings,
  isSavingSettings,
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const settings = whatsappSettings || {
    enabled: false,
    phoneNumber: '',
    sendTime: '21:00',
    includeLowStock: true,
    includeTopProducts: true,
    ownerName: '',
  };

  const { data: preview, isLoading: isPreviewLoading, refetch: refetchPreview } =
    usePreviewWhatsappSummaryQuery(undefined, { skip: !canManage });
  const { data, isLoading, isFetching } = useListWhatsappSummariesQuery(
    { page, limit: 10 },
    { skip: !canManage }
  );
  const [sendSummary, { isLoading: isSending }] = useSendWhatsappSummaryMutation();
  const [sendTest, { isLoading: isTesting }] = useSendWhatsappTestMutation();

  const summaries = data?.items ?? [];
  const meta = data?.meta;

  function handleSettingsSubmit(event) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    onSaveSettings({
      enabled: formData.get('enabled') === 'on',
      phoneNumber: String(formData.get('phoneNumber') || '').trim(),
      sendTime: String(formData.get('sendTime') || '21:00'),
      includeLowStock: formData.get('includeLowStock') === 'on',
      includeTopProducts: formData.get('includeTopProducts') === 'on',
      ownerName: String(formData.get('ownerName') || '').trim(),
    });
  }

  async function handleSendNow() {
    try {
      await sendSummary({ force: true }).unwrap();
      toast.success(t('whatsapp.sendSuccess'));
      refetchPreview();
    } catch (error) {
      toast.error(getErrorMessage(error, t('whatsapp.errors.sendFailed')));
    }
  }

  async function handleSendTest() {
    try {
      await sendTest({}).unwrap();
      toast.success(t('whatsapp.testSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('whatsapp.errors.testFailed')));
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSettingsSubmit}
        className="space-y-4 rounded-xl border border-border bg-white p-5"
      >
        <div>
          <h3 className="text-[15px] font-semibold">{t('whatsapp.settingsTitle')}</h3>
          <p className="mt-1 text-[13px] text-muted">{t('whatsapp.settingsSubtitle')}</p>
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            disabled={!canManage || isSavingSettings}
            className="h-4 w-4 rounded border-border text-primary"
          />
          {t('whatsapp.enabled')}
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('whatsapp.phoneNumber')}</label>
            <Input
              name="phoneNumber"
              defaultValue={settings.phoneNumber}
              placeholder="+923001234567"
              disabled={!canManage || isSavingSettings}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">{t('whatsapp.sendTime')}</label>
            <Input
              type="time"
              name="sendTime"
              defaultValue={settings.sendTime}
              disabled={!canManage || isSavingSettings}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium">{t('whatsapp.ownerName')}</label>
            <Input
              name="ownerName"
              defaultValue={settings.ownerName}
              placeholder={t('whatsapp.ownerNamePlaceholder')}
              disabled={!canManage || isSavingSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="includeTopProducts"
              defaultChecked={settings.includeTopProducts}
              disabled={!canManage || isSavingSettings}
              className="h-4 w-4 rounded border-border text-primary"
            />
            {t('whatsapp.includeTopProducts')}
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="includeLowStock"
              defaultChecked={settings.includeLowStock}
              disabled={!canManage || isSavingSettings}
              className="h-4 w-4 rounded border-border text-primary"
            />
            {t('whatsapp.includeLowStock')}
          </label>
        </div>

        {preview ? (
          <p className="text-[12px] text-muted">
            {preview.twilioConfigured || preview.dryRunEnabled
              ? t('whatsapp.deliveryReady')
              : t('whatsapp.deliveryNotConfigured')}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleSendTest} disabled={isTesting}>
              <MessageCircle size={16} />
              {isTesting ? t('whatsapp.testing') : t('whatsapp.sendTest')}
            </Button>
            <Button type="submit" variant="outline" disabled={isSavingSettings}>
              {isSavingSettings ? t('settings.saving') : t('whatsapp.saveSettings')}
            </Button>
          </div>
        ) : null}
      </form>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">{t('whatsapp.previewTitle')}</h3>
            <p className="mt-1 text-[13px] text-muted">{t('whatsapp.previewSubtitle')}</p>
          </div>
          {canManage ? (
            <Button type="button" onClick={handleSendNow} disabled={isSending || isPreviewLoading}>
              <Send size={16} />
              {isSending ? t('whatsapp.sending') : t('whatsapp.sendNow')}
            </Button>
          ) : null}
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-[#fafafa] p-4 text-[12px] leading-5 whitespace-pre-wrap">
          {isPreviewLoading
            ? t('whatsapp.loadingPreview')
            : preview?.digest?.message || t('whatsapp.emptyPreview')}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="mb-4 text-[15px] font-semibold">{t('whatsapp.historyTitle')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-border bg-[#fafafa] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t('whatsapp.table.date')}</th>
                <th className="px-4 py-3 font-medium">{t('whatsapp.table.recipient')}</th>
                <th className="px-4 py-3 font-medium">{t('whatsapp.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('whatsapp.table.sentAt')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    {t('whatsapp.loading')}
                  </td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    {t('whatsapp.empty')}
                  </td>
                </tr>
              ) : (
                summaries.map((summary) => (
                  <tr key={summary.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">{summary.summaryDate}</td>
                    <td className="px-4 py-3">{summary.recipientPhone}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          summary.status === 'sent'
                            ? 'text-success'
                            : summary.status === 'failed'
                              ? 'text-danger'
                              : 'text-muted'
                        }
                      >
                        {t(`whatsapp.statuses.${summary.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDateTime(summary.sentAt)}</td>
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
    </div>
  );
}
