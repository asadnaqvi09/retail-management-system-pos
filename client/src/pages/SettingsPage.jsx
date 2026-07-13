import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import SettingsWhatsappPanel from '../organisms/SettingsWhatsappPanel/SettingsWhatsappPanel';
import SettingsBackupPanel from '../organisms/SettingsBackupPanel/SettingsBackupPanel';
import SettingsUsersPanel from '../organisms/SettingsUsersPanel/SettingsUsersPanel';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useGetSettingsQuery,
  useUpdateStoreMutation,
  useUploadStoreLogoMutation,
  useRemoveStoreLogoMutation,
  useUpdateSettingsSectionMutation,
  useCreateTaxClassMutation,
  useUpdateTaxClassMutation,
  useDeleteTaxClassMutation,
  useUpdateShortcutsMutation,
} from '../store/settingsApi';

const TABS = [
  'business',
  'receipt',
  'tax',
  'users',
  'language',
  'printer',
  'barcode',
  'shortcuts',
  'backup',
  'whatsapp',
];

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[13px] font-medium">{label}</label>
      {children}
    </div>
  );
}

function CheckboxField({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border text-primary"
      />
      {label}
    </label>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission('settings.view');
  const canManage = hasPermission('settings.manage');
  const canManageUsers = hasPermission('auth.manage_users');
  const canManageBackup = hasPermission('backup.manage');
  const canManageWhatsapp = hasPermission('whatsapp.manage');
  const logoInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('business');
  const [storeForm, setStoreForm] = useState(null);
  const [receiptForm, setReceiptForm] = useState(null);
  const [taxForm, setTaxForm] = useState(null);
  const [languageForm, setLanguageForm] = useState(null);
  const [printerForm, setPrinterForm] = useState(null);
  const [barcodeForm, setBarcodeForm] = useState(null);
  const [shortcutsForm, setShortcutsForm] = useState(null);
  const [newTaxClass, setNewTaxClass] = useState({ name: '', rate: '', isDefault: false });

  const { data, isLoading, error } = useGetSettingsQuery(undefined, { skip: !canView });
  const [updateStore, { isLoading: isSavingStore }] = useUpdateStoreMutation();
  const [uploadLogo, { isLoading: isUploadingLogo }] = useUploadStoreLogoMutation();
  const [removeLogo, { isLoading: isRemovingLogo }] = useRemoveStoreLogoMutation();
  const [updateSection, { isLoading: isSavingSection }] = useUpdateSettingsSectionMutation();
  const [createTaxClass, { isLoading: isCreatingTax }] = useCreateTaxClassMutation();
  const [updateTaxClass] = useUpdateTaxClassMutation();
  const [deleteTaxClass] = useDeleteTaxClassMutation();
  const [updateShortcuts, { isLoading: isSavingShortcuts }] = useUpdateShortcutsMutation();

  useEffect(() => {
    if (!data) {
      return;
    }
    setStoreForm({ ...data.store });
    setReceiptForm({ ...data.sections.receipt });
    setTaxForm({ ...data.sections.tax });
    setLanguageForm({ ...data.sections.language });
    setPrinterForm({ ...data.sections.printer });
    setBarcodeForm({ ...data.sections.barcode });
    setShortcutsForm(data.shortcuts.map((item) => ({ ...item })));
  }, [data]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  async function handleSaveBusiness(event) {
    event.preventDefault();
    if (!canManage || !storeForm) {
      return;
    }
    try {
      await updateStore({
        name: storeForm.name,
        email: storeForm.email,
        website: storeForm.website,
        phone: storeForm.phone,
        taxId: storeForm.taxId,
        address: storeForm.address,
        city: storeForm.city,
        country: storeForm.country,
        timezone: storeForm.timezone,
        businessDayStartTime: storeForm.businessDayStartTime,
        returnPolicyDays: Number(storeForm.returnPolicyDays),
        allowOversell: storeForm.allowOversell,
        currencyCode: storeForm.currencyCode,
        currencySymbol: storeForm.currencySymbol,
        defaultLanguage: storeForm.defaultLanguage,
      }).unwrap();
      toast.success(t('settings.saveSuccess'));
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
    }
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !canManage) {
      return;
    }
    try {
      await uploadLogo(file).unwrap();
      toast.success(t('settings.saveSuccess'));
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, t('settings.errors.saveFailed')));
    } finally {
      event.target.value = '';
    }
  }

  async function handleRemoveLogo() {
    if (!canManage) {
      return;
    }
    try {
      await removeLogo().unwrap();
      toast.success(t('settings.saveSuccess'));
    } catch (removeError) {
      toast.error(getErrorMessage(removeError, t('settings.errors.saveFailed')));
    }
  }

  async function handleSaveSection(section, values, onLanguageChange) {
    if (!canManage) {
      return;
    }
    try {
      await updateSection({ section, values }).unwrap();
      if (onLanguageChange) {
        i18n.changeLanguage(values.defaultLanguage);
      }
      toast.success(t('settings.saveSuccess'));
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
    }
  }

  async function handleCreateTaxClass(event) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    try {
      await createTaxClass({
        name: newTaxClass.name.trim(),
        rate: Number(newTaxClass.rate),
        isDefault: newTaxClass.isDefault,
      }).unwrap();
      setNewTaxClass({ name: '', rate: '', isDefault: false });
      toast.success(t('settings.tax.createSuccess'));
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
    }
  }

  async function handleTaxClassToggle(taxClass, field, value) {
    if (!canManage) {
      return;
    }
    try {
      await updateTaxClass({
        taxClassId: taxClass.id,
        body: { [field]: value },
      }).unwrap();
      toast.success(t('settings.tax.updateSuccess'));
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
    }
  }

  async function handleDeleteTaxClass(taxClassId) {
    if (!canManage) {
      return;
    }
    try {
      await deleteTaxClass(taxClassId).unwrap();
      toast.success(t('settings.tax.deleteSuccess'));
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
    }
  }

  function updateShortcut(actionKey, field, value) {
    setShortcutsForm((current) =>
      current.map((item) =>
        item.actionKey === actionKey ? { ...item, [field]: value } : item
      )
    );
  }

  const isSaving =
    isSavingStore ||
    isSavingSection ||
    isUploadingLogo ||
    isRemovingLogo ||
    isCreatingTax ||
    isSavingShortcuts;

  const visibleTabs = TABS.filter((tab) => {
    if (tab === 'backup') {
      return canManageBackup;
    }
    if (tab === 'whatsapp') {
      return canManageWhatsapp;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">{t('settings.title')}</h1>
        <p className="mt-1 text-[14px] text-muted">{t('settings.subtitle')}</p>
        {!canManage ? (
          <p className="mt-2 text-[13px] text-warning">{t('settings.readOnly')}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-muted">
          {t('settings.loading')}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-8 text-center text-danger">
          {t('settings.errors.loadFailed')}
        </div>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="lg:w-56">
            <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {visibleTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                    activeTab === tab
                      ? 'bg-primary text-white'
                      : 'text-muted hover:bg-[#f4f4f8] hover:text-foreground'
                  )}
                >
                  {t(`settings.tabs.${tab}`)}
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {activeTab === 'business' && storeForm ? (
              <form onSubmit={handleSaveBusiness} className="space-y-5 rounded-xl border border-border bg-white p-5">
                <h3 className="text-[15px] font-semibold">{t('settings.business.title')}</h3>
                <div className="flex flex-wrap items-center gap-4">
                  {storeForm.logoUrl ? (
                    <img
                      src={storeForm.logoUrl}
                      alt={storeForm.name}
                      className="h-16 w-16 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted">
                      {t('settings.business.logo')}
                    </div>
                  )}
                  {canManage ? (
                    <div className="flex gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                        {t('settings.business.uploadLogo')}
                      </Button>
                      {storeForm.logoUrl ? (
                        <Button type="button" variant="ghost" onClick={handleRemoveLogo}>
                          {t('settings.business.removeLogo')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t('settings.business.name')}>
                    <Input
                      value={storeForm.name}
                      onChange={(e) => setStoreForm((c) => ({ ...c, name: e.target.value }))}
                      disabled={!canManage || isSaving}
                      required
                    />
                  </Field>
                  <Field label={t('settings.business.phone')}>
                    <Input
                      value={storeForm.phone || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, phone: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.email')}>
                    <Input
                      type="email"
                      value={storeForm.email || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, email: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.website')}>
                    <Input
                      value={storeForm.website || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, website: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.taxId')} className="md:col-span-2">
                    <Input
                      value={storeForm.taxId || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, taxId: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.address')} className="md:col-span-2">
                    <Input
                      value={storeForm.address || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, address: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.city')}>
                    <Input
                      value={storeForm.city || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, city: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.country')}>
                    <Input
                      value={storeForm.country || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, country: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.timezone')}>
                    <Input
                      value={storeForm.timezone || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, timezone: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.businessDayStart')}>
                    <Input
                      type="time"
                      value={String(storeForm.businessDayStartTime || '09:00').slice(0, 5)}
                      onChange={(e) =>
                        setStoreForm((c) => ({ ...c, businessDayStartTime: `${e.target.value}:00` }))
                      }
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.currencyCode')}>
                    <Input
                      value={storeForm.currencyCode || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, currencyCode: e.target.value }))}
                      disabled={!canManage || isSaving}
                      maxLength={3}
                    />
                  </Field>
                  <Field label={t('settings.business.currencySymbol')}>
                    <Input
                      value={storeForm.currencySymbol || ''}
                      onChange={(e) => setStoreForm((c) => ({ ...c, currencySymbol: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.business.returnPolicyDays')}>
                    <Input
                      type="number"
                      min="0"
                      value={storeForm.returnPolicyDays}
                      onChange={(e) =>
                        setStoreForm((c) => ({ ...c, returnPolicyDays: e.target.value }))
                      }
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                </div>
                <CheckboxField
                  label={t('settings.business.allowOversell')}
                  checked={Boolean(storeForm.allowOversell)}
                  onChange={(value) => setStoreForm((c) => ({ ...c, allowOversell: value }))}
                  disabled={!canManage || isSaving}
                />
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'receipt' && receiptForm ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveSection('receipt', receiptForm);
                }}
                className="space-y-5 rounded-xl border border-border bg-white p-5"
              >
                <h3 className="text-[15px] font-semibold">{t('settings.receipt.title')}</h3>
                <div className="grid grid-cols-1 gap-4">
                  <Field label={t('settings.receipt.headerText')}>
                    <Input
                      value={receiptForm.headerText || ''}
                      onChange={(e) => setReceiptForm((c) => ({ ...c, headerText: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.receipt.footerText')}>
                    <Input
                      value={receiptForm.footerText || ''}
                      onChange={(e) => setReceiptForm((c) => ({ ...c, footerText: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.receipt.thankYouMessage')}>
                    <Input
                      value={receiptForm.thankYouMessage || ''}
                      onChange={(e) => setReceiptForm((c) => ({ ...c, thankYouMessage: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.receipt.returnPolicyText')}>
                    <Input
                      value={receiptForm.returnPolicyText || ''}
                      onChange={(e) => setReceiptForm((c) => ({ ...c, returnPolicyText: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.receipt.defaultFormat')}>
                    <select
                      value={receiptForm.defaultFormat || 'thermal'}
                      onChange={(e) => setReceiptForm((c) => ({ ...c, defaultFormat: e.target.value }))}
                      disabled={!canManage || isSaving}
                      className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                    >
                      <option value="thermal">{t('settings.receipt.formats.thermal')}</option>
                      <option value="a4">{t('settings.receipt.formats.a4')}</option>
                    </select>
                  </Field>
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    label={t('settings.receipt.autoPrint')}
                    checked={Boolean(receiptForm.autoPrint)}
                    onChange={(value) => setReceiptForm((c) => ({ ...c, autoPrint: value }))}
                    disabled={!canManage || isSaving}
                  />
                  <CheckboxField
                    label={t('settings.receipt.showBarcode')}
                    checked={Boolean(receiptForm.showBarcode)}
                    onChange={(value) => setReceiptForm((c) => ({ ...c, showBarcode: value }))}
                    disabled={!canManage || isSaving}
                  />
                  <CheckboxField
                    label={t('settings.receipt.showQr')}
                    checked={Boolean(receiptForm.showQr)}
                    onChange={(value) => setReceiptForm((c) => ({ ...c, showQr: value }))}
                    disabled={!canManage || isSaving}
                  />
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'tax' && taxForm ? (
              <div className="space-y-5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSaveSection('tax', taxForm);
                  }}
                  className="space-y-4 rounded-xl border border-border bg-white p-5"
                >
                  <h3 className="text-[15px] font-semibold">{t('settings.tax.title')}</h3>
                  <div className="space-y-2">
                    <CheckboxField
                      label={t('settings.tax.pricesIncludeTax')}
                      checked={Boolean(taxForm.pricesIncludeTax)}
                      onChange={(value) => setTaxForm((c) => ({ ...c, pricesIncludeTax: value }))}
                      disabled={!canManage || isSaving}
                    />
                    <CheckboxField
                      label={t('settings.tax.showTaxOnReceipt')}
                      checked={Boolean(taxForm.showTaxOnReceipt)}
                      onChange={(value) => setTaxForm((c) => ({ ...c, showTaxOnReceipt: value }))}
                      disabled={!canManage || isSaving}
                    />
                    <CheckboxField
                      label={t('settings.tax.displayTaxBreakdown')}
                      checked={Boolean(taxForm.displayTaxBreakdown)}
                      onChange={(value) => setTaxForm((c) => ({ ...c, displayTaxBreakdown: value }))}
                      disabled={!canManage || isSaving}
                    />
                  </div>
                  {canManage ? (
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? t('settings.saving') : t('settings.save')}
                      </Button>
                    </div>
                  ) : null}
                </form>

                <div className="rounded-xl border border-border bg-white p-5">
                  <h3 className="mb-4 text-[15px] font-semibold">{t('settings.tax.classesTitle')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[13px]">
                      <thead className="border-b border-border text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t('settings.tax.name')}</th>
                          <th className="px-3 py-2 font-medium">{t('settings.tax.rate')}</th>
                          <th className="px-3 py-2 font-medium">{t('settings.tax.default')}</th>
                          <th className="px-3 py-2 font-medium">{t('settings.tax.active')}</th>
                          {canManage ? (
                            <th className="px-3 py-2 font-medium">{t('settings.tax.actions')}</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.taxClasses || []).map((taxClass) => (
                          <tr key={taxClass.id} className="border-b border-border last:border-b-0">
                            <td className="px-3 py-2">{taxClass.name}</td>
                            <td className="px-3 py-2 tabular-nums">{taxClass.rate}%</td>
                            <td className="px-3 py-2">
                              <input
                                type="radio"
                                name="defaultTaxClass"
                                checked={taxClass.isDefault}
                                onChange={() => handleTaxClassToggle(taxClass, 'isDefault', true)}
                                disabled={!canManage}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={taxClass.isActive}
                                onChange={(event) =>
                                  handleTaxClassToggle(taxClass, 'isActive', event.target.checked)
                                }
                                disabled={!canManage}
                              />
                            </td>
                            {canManage ? (
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTaxClass(taxClass.id)}
                                >
                                  {t('settings.tax.remove')}
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {canManage ? (
                    <form onSubmit={handleCreateTaxClass} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Input
                        placeholder={t('settings.tax.name')}
                        value={newTaxClass.name}
                        onChange={(e) => setNewTaxClass((c) => ({ ...c, name: e.target.value }))}
                        required
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder={t('settings.tax.rate')}
                        value={newTaxClass.rate}
                        onChange={(e) => setNewTaxClass((c) => ({ ...c, rate: e.target.value }))}
                        required
                      />
                      <CheckboxField
                        label={t('settings.tax.default')}
                        checked={newTaxClass.isDefault}
                        onChange={(value) => setNewTaxClass((c) => ({ ...c, isDefault: value }))}
                      />
                      <Button type="submit" disabled={isCreatingTax}>
                        {t('settings.tax.addClass')}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'users' ? (
              <div className="rounded-xl border border-border bg-white p-5">
                <SettingsUsersPanel canManageUsers={canManageUsers} />
              </div>
            ) : null}

            {activeTab === 'language' && languageForm ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveSection('language', languageForm, true);
                }}
                className="space-y-5 rounded-xl border border-border bg-white p-5"
              >
                <h3 className="text-[15px] font-semibold">{t('settings.language.title')}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t('settings.language.defaultLanguage')}>
                    <select
                      value={languageForm.defaultLanguage || 'en'}
                      onChange={(e) =>
                        setLanguageForm((c) => ({ ...c, defaultLanguage: e.target.value }))
                      }
                      disabled={!canManage || isSaving}
                      className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                    >
                      <option value="en">{t('settings.language.languages.en')}</option>
                      <option value="ur-Roman">{t('settings.language.languages.ur-Roman')}</option>
                    </select>
                  </Field>
                  <Field label={t('settings.language.dateFormat')}>
                    <Input
                      value={languageForm.dateFormat || ''}
                      onChange={(e) => setLanguageForm((c) => ({ ...c, dateFormat: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.language.timeFormat')}>
                    <select
                      value={languageForm.timeFormat || '12h'}
                      onChange={(e) => setLanguageForm((c) => ({ ...c, timeFormat: e.target.value }))}
                      disabled={!canManage || isSaving}
                      className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                    >
                      <option value="12h">{t('settings.language.timeFormats.12h')}</option>
                      <option value="24h">{t('settings.language.timeFormats.24h')}</option>
                    </select>
                  </Field>
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'printer' && printerForm ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveSection('printer', printerForm);
                }}
                className="space-y-5 rounded-xl border border-border bg-white p-5"
              >
                <h3 className="text-[15px] font-semibold">{t('settings.printer.title')}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t('settings.printer.invoicePrinter')}>
                    <Input
                      value={printerForm.invoicePrinter || ''}
                      onChange={(e) => setPrinterForm((c) => ({ ...c, invoicePrinter: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.printer.labelPrinter')}>
                    <Input
                      value={printerForm.labelPrinter || ''}
                      onChange={(e) => setPrinterForm((c) => ({ ...c, labelPrinter: e.target.value }))}
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                  <Field label={t('settings.printer.receiptPaperWidth')}>
                    <select
                      value={printerForm.receiptPaperWidth || '80mm'}
                      onChange={(e) =>
                        setPrinterForm((c) => ({ ...c, receiptPaperWidth: e.target.value }))
                      }
                      disabled={!canManage || isSaving}
                      className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                    >
                      <option value="58mm">{t('settings.printer.widths.58mm')}</option>
                      <option value="80mm">{t('settings.printer.widths.80mm')}</option>
                    </select>
                  </Field>
                </div>
                <CheckboxField
                  label={t('settings.printer.silentPrint')}
                  checked={Boolean(printerForm.silentPrint)}
                  onChange={(value) => setPrinterForm((c) => ({ ...c, silentPrint: value }))}
                  disabled={!canManage || isSaving}
                />
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'barcode' && barcodeForm ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveSection('barcode', {
                    ...barcodeForm,
                    defaultCopies: Number(barcodeForm.defaultCopies) || 1,
                  });
                }}
                className="space-y-5 rounded-xl border border-border bg-white p-5"
              >
                <h3 className="text-[15px] font-semibold">{t('settings.barcode.title')}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t('settings.barcode.defaultTemplate')}>
                    <select
                      value={barcodeForm.defaultTemplate || '40x30'}
                      onChange={(e) =>
                        setBarcodeForm((c) => ({ ...c, defaultTemplate: e.target.value }))
                      }
                      disabled={!canManage || isSaving}
                      className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
                    >
                      <option value="40x30">{t('settings.barcode.templates.40x30')}</option>
                      <option value="50x25">{t('settings.barcode.templates.50x25')}</option>
                      <option value="a4_sheet">{t('settings.barcode.templates.a4_sheet')}</option>
                    </select>
                  </Field>
                  <Field label={t('settings.barcode.defaultCopies')}>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={barcodeForm.defaultCopies ?? 1}
                      onChange={(e) =>
                        setBarcodeForm((c) => ({ ...c, defaultCopies: e.target.value }))
                      }
                      disabled={!canManage || isSaving}
                    />
                  </Field>
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    label={t('settings.barcode.showPrice')}
                    checked={Boolean(barcodeForm.showPrice)}
                    onChange={(value) => setBarcodeForm((c) => ({ ...c, showPrice: value }))}
                    disabled={!canManage || isSaving}
                  />
                  <CheckboxField
                    label={t('settings.barcode.showProductName')}
                    checked={Boolean(barcodeForm.showProductName)}
                    onChange={(value) => setBarcodeForm((c) => ({ ...c, showProductName: value }))}
                    disabled={!canManage || isSaving}
                  />
                  <CheckboxField
                    label={t('settings.barcode.showSku')}
                    checked={Boolean(barcodeForm.showSku)}
                    onChange={(value) => setBarcodeForm((c) => ({ ...c, showSku: value }))}
                    disabled={!canManage || isSaving}
                  />
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'shortcuts' && shortcutsForm ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!canManage) {
                    return;
                  }
                  try {
                    await updateShortcuts(
                      shortcutsForm.map((item) => ({
                        actionKey: item.actionKey,
                        shortcutKeys: item.shortcutKeys,
                        description: item.description,
                        isActive: item.isActive,
                      }))
                    ).unwrap();
                    toast.success(t('settings.saveSuccess'));
                  } catch (saveError) {
                    toast.error(getErrorMessage(saveError, t('settings.errors.saveFailed')));
                  }
                }}
                className="space-y-5 rounded-xl border border-border bg-white p-5"
              >
                <div>
                  <h3 className="text-[15px] font-semibold">{t('settings.shortcuts.title')}</h3>
                  <p className="mt-1 text-[13px] text-muted">{t('settings.shortcuts.subtitle')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead className="border-b border-border text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t('settings.shortcuts.action')}</th>
                        <th className="px-3 py-2 font-medium">{t('settings.shortcuts.keys')}</th>
                        <th className="px-3 py-2 font-medium">{t('settings.shortcuts.description')}</th>
                        <th className="px-3 py-2 font-medium">{t('settings.shortcuts.active')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortcutsForm.map((shortcut) => (
                        <tr key={shortcut.actionKey} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-2">
                            {t(`settings.shortcuts.actions.${shortcut.actionKey}`, {
                              defaultValue: shortcut.actionKey,
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={shortcut.shortcutKeys}
                              onChange={(e) =>
                                updateShortcut(shortcut.actionKey, 'shortcutKeys', e.target.value)
                              }
                              disabled={!canManage || isSaving}
                              className="h-9"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={shortcut.description || ''}
                              onChange={(e) =>
                                updateShortcut(shortcut.actionKey, 'description', e.target.value)
                              }
                              disabled={!canManage || isSaving}
                              className="h-9"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={shortcut.isActive}
                              onChange={(e) =>
                                updateShortcut(shortcut.actionKey, 'isActive', e.target.checked)
                              }
                              disabled={!canManage || isSaving}
                              className="h-4 w-4"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSavingShortcuts}>
                      {isSavingShortcuts ? t('settings.saving') : t('settings.save')}
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {activeTab === 'backup' && canManageBackup ? (
              <SettingsBackupPanel
                backupSettings={data?.sections?.backup}
                canManage={canManage}
                isSavingSettings={isSavingSection}
                onSaveSettings={async (values) => {
                  await handleSaveSection('backup', values);
                }}
              />
            ) : null}

            {activeTab === 'whatsapp' && canManageWhatsapp ? (
              <SettingsWhatsappPanel
                whatsappSettings={data?.sections?.whatsapp}
                canManage={canManage}
                isSavingSettings={isSavingSection}
                onSaveSettings={async (values) => {
                  await handleSaveSection('whatsapp', values);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
