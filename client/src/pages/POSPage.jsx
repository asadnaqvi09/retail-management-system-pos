import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import POSNavbar from '../organisms/POSNavbar';
import POSCartPanel from '../organisms/POSCartPanel';
import POSPaymentPanel from '../organisms/POSPaymentPanel';
import POSHoldCartDrawer from '../organisms/POSHoldCartDrawer';
import CashRegisterModal from '../organisms/CashRegisterModal';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import {
  useLookupVariantMutation,
  usePreviewSaleMutation,
  useCreateSaleMutation,
  useListHoldCartsQuery,
  useCreateHoldCartMutation,
  useResumeHoldCartMutation,
  useCancelHoldCartMutation,
} from '../store/salesApi';
import { useGetCurrentSessionQuery } from '../store/cashRegisterApi';
import {
  useGetInvoicePdfMutation,
  useCreateInvoicePrintLogMutation,
} from '../store/invoicesApi';
import { printPdfBlob } from '../lib/printInvoice';
import {
  buildShortcutMap,
  isEditableTarget,
  matchesKeyboardShortcut,
} from '../lib/keyboardShortcuts';
import { useGetShortcutsQuery } from '../store/settingsApi';

function buildCartLineFromLookup(data) {
  return {
    variantId: data.variantId,
    productName: data.product.name,
    sku: data.sku,
    barcode: data.barcode,
    unitPrice: data.unitPrice,
    quantity: 1,
    lineDiscount: 0,
    attributes: data.attributes,
    stock: data.stock.quantityOnHand,
    imageUrl: data.product.imageUrl,
    taxRate: data.taxRate,
    promotion: data.promotion || null,
  };
}

function buildCartLineFromHold(line) {
  return {
    variantId: line.variantId,
    productName: line.productName,
    sku: line.sku,
    barcode: line.barcode,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    lineDiscount: line.lineDiscount,
    attributes: line.attributes,
    stock: 0,
    imageUrl: null,
    taxRate: 0,
  };
}

export default function POSPage() {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const canSell = hasPermission('sales.create');
  const canHoldCart = hasPermission('sales.hold_cart');
  const canManageRegister = hasPermission('cash_register.open_close');
  const canManageCustomers = hasPermission('customers.manage');
  const canPickCustomers = hasPermission('customers.view');
  const canPrintInvoice = hasPermission('invoices.print');
  const [searchValue, setSearchValue] = useState('');
  const [cartLines, setCartLines] = useState([]);
  const [totals, setTotals] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderedInput, setTenderedInput] = useState('');
  const [activeHoldCartId, setActiveHoldCartId] = useState(null);
  const [saleLabel, setSaleLabel] = useState('');
  const [holdDrawerOpen, setHoldDrawerOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerPrompted, setRegisterPrompted] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [lookupVariant, { isLoading: isSearching }] = useLookupVariantMutation();
  const [previewSale, { isLoading: isPreviewLoading }] = usePreviewSaleMutation();
  const [createSale, { isLoading: isCompleting }] = useCreateSaleMutation();
  const [createHoldCart, { isLoading: isHolding }] = useCreateHoldCartMutation();
  const [resumeHoldCart] = useResumeHoldCartMutation();
  const [cancelHoldCart] = useCancelHoldCartMutation();
  const {
    data: holdCarts = [],
    isLoading: isHoldCartsLoading,
    refetch: refetchHoldCarts,
  } = useListHoldCartsQuery(undefined, { skip: !canHoldCart });
  const {
    data: registerSession,
    isLoading: isRegisterLoading,
    refetch: refetchRegisterSession,
  } = useGetCurrentSessionQuery(undefined, { skip: !canManageRegister });
  const [getInvoicePdf] = useGetInvoicePdfMutation();
  const [createInvoicePrintLog] = useCreateInvoicePrintLogMutation();
  const searchInputRef = useRef(null);
  const completeSaleRef = useRef(() => {});
  const holdActionRef = useRef(() => {});
  const { data: shortcuts = [] } = useGetShortcutsQuery(undefined, { skip: !canSell });

  const isRegisterOpen = registerSession?.status === 'open';
  const isRegisterOwner = registerSession?.user?.id === user?.id;

  const previewPayload = useMemo(
    () =>
      cartLines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        lineDiscount: line.lineDiscount || 0,
      })),
    [cartLines]
  );

  const displayLines = useMemo(() => {
    if (!totals?.lines?.length) {
      return cartLines;
    }
    return cartLines.map((line) => {
      const computed = totals.lines.find((item) => item.variantId === line.variantId);
      if (!computed) {
        return line;
      }
      return {
        ...line,
        lineTotal: computed.lineTotal,
        promoDiscount: computed.promoDiscount,
        promotionName: computed.promotionName,
        promotionId: computed.promotionId,
      };
    });
  }, [cartLines, totals]);

  const taxRateLabel = useMemo(() => {
    const rates = [...new Set(cartLines.map((line) => line.taxRate).filter(Boolean))];
    if (rates.length === 1) {
      return `${rates[0]}%`;
    }
    return null;
  }, [cartLines]);

  const saleTotal = totals?.total ?? 0;
  const tenderedAmount = Number(tenderedInput) || 0;
  const changeAmount =
    paymentMethod === 'cash' && tenderedAmount > saleTotal
      ? Math.round((tenderedAmount - saleTotal) * 100) / 100
      : 0;
  const canCheckout =
    cartLines.length > 0 &&
    saleTotal > 0 &&
    isRegisterOpen &&
    isRegisterOwner &&
    (paymentMethod !== 'cash' || tenderedAmount >= saleTotal);

  const refreshPreview = useCallback(async () => {
    if (previewPayload.length === 0) {
      setTotals(null);
      return;
    }
    try {
      const result = await previewSale({ lines: previewPayload }).unwrap();
      setTotals(result);
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.previewFailed')));
    }
  }, [previewPayload, previewSale, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  useEffect(() => {
    if (paymentMethod !== 'cash' && saleTotal > 0) {
      setTenderedInput(String(saleTotal));
    }
  }, [paymentMethod, saleTotal]);

  useEffect(() => {
    if (isRegisterLoading || registerPrompted || !canManageRegister) {
      return;
    }
    if (!registerSession) {
      setRegisterModalOpen(true);
      setRegisterPrompted(true);
    }
  }, [isRegisterLoading, registerSession, registerPrompted, canManageRegister]);

  useEffect(() => {
    if (!canSell) {
      return undefined;
    }
    const shortcutMap = buildShortcutMap(shortcuts);
    function onKeyDown(event) {
      const focusShortcut = shortcutMap.get('focus_search');
      if (focusShortcut && matchesKeyboardShortcut(event, focusShortcut)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (isEditableTarget(event.target) && event.target !== searchInputRef.current) {
        return;
      }

      const holdShortcut = shortcutMap.get('hold_cart');
      if (holdShortcut && matchesKeyboardShortcut(event, holdShortcut)) {
        event.preventDefault();
        holdActionRef.current();
        return;
      }

      const chargeShortcut = shortcutMap.get('charge');
      if (chargeShortcut && matchesKeyboardShortcut(event, chargeShortcut)) {
        event.preventDefault();
        completeSaleRef.current();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canSell, shortcuts]);

  async function triggerInvoicePrint(saleId, invoiceNumber, format = 'thermal') {
    if (!canPrintInvoice || !saleId) {
      return;
    }
    try {
      const result = await getInvoicePdf({ saleId, format }).unwrap();
      const label = invoiceNumber || result.invoiceNumber || 'invoice';
      await printPdfBlob(result.blob, `${label}-${format}.pdf`);
      await createInvoicePrintLog({
        saleId,
        format: result.format || format,
        status: 'printed',
      }).unwrap();
    } catch (error) {
      const message = getErrorMessage(error, t('invoices.errors.printFailed'));
      try {
        await createInvoicePrintLog({
          saleId,
          format,
          status: 'failed',
          errorMessage: message,
        }).unwrap();
      } catch (logError) {
        // Ignore secondary logging failures.
      }
      if (error?.message === 'POPUP_BLOCKED') {
        toast.error(t('invoices.errors.popupBlocked'));
      } else {
        toast.error(message);
      }
    }
  }

  function resetSaleState(nextLabel = '') {
    setCartLines([]);
    setTotals(null);
    setTenderedInput('');
    setPaymentMethod('cash');
    setActiveHoldCartId(null);
    setSaleLabel(nextLabel);
    setSearchValue('');
    setSelectedCustomer(null);
  }

  async function handleSearchSubmit() {
    const code = searchValue.trim();
    if (!code) {
      return;
    }
    try {
      const data = await lookupVariant(code).unwrap();
      setCartLines((current) => {
        const existing = current.find((line) => line.variantId === data.variantId);
        if (existing) {
          if (existing.quantity >= data.stock.quantityOnHand) {
            toast.error(t('pos.errors.insufficientStock'));
            return current;
          }
          return current.map((line) =>
            line.variantId === data.variantId
              ? { ...line, quantity: line.quantity + 1, stock: data.stock.quantityOnHand }
              : line
          );
        }
        if (data.stock.quantityOnHand < 1) {
          toast.error(t('pos.errors.outOfStock'));
          return current;
        }
        return [...current, buildCartLineFromLookup(data)];
      });
      setSearchValue('');
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.lookupFailed')));
    }
  }

  function updateQuantity(variantId, delta) {
    setCartLines((current) =>
      current
        .map((line) => {
          if (line.variantId !== variantId) {
            return line;
          }
          const nextQuantity = line.quantity + delta;
          if (nextQuantity < 1) {
            return null;
          }
          if (line.stock > 0 && nextQuantity > line.stock) {
            toast.error(t('pos.errors.insufficientStock'));
            return line;
          }
          return { ...line, quantity: nextQuantity };
        })
        .filter(Boolean)
    );
  }

  function removeLine(variantId) {
    setCartLines((current) => current.filter((line) => line.variantId !== variantId));
  }

  async function handleCompleteSale() {
    if (!canCheckout) {
      if (!isRegisterOpen || !isRegisterOwner) {
        setRegisterModalOpen(true);
        toast.error(t('cashRegister.errors.sessionRequired'));
      }
      return;
    }
    try {
      const sale = await createSale({
        lines: previewPayload,
        payments: [
          {
            method: paymentMethod,
            amount: saleTotal,
            tenderedAmount: paymentMethod === 'cash' ? tenderedAmount : undefined,
            changeAmount: paymentMethod === 'cash' ? changeAmount : undefined,
          },
        ],
        holdCartId: activeHoldCartId,
        cashRegisterSessionId: registerSession.id,
        customerId: selectedCustomer?.id || null,
      }).unwrap();
      toast.success(t('pos.saleSuccess', { invoice: sale.invoiceNumber }));
      resetSaleState(sale.invoiceNumber);
      refetchRegisterSession();
      triggerInvoicePrint(sale.id, sale.invoiceNumber);
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.checkoutFailed')));
    }
  }

  async function handleHoldAction() {
    if (!canHoldCart) {
      return;
    }
    if (cartLines.length === 0) {
      await refetchHoldCarts();
      setHoldDrawerOpen(true);
      return;
    }
    try {
      await createHoldCart({
        label: saleLabel || t('pos.unnamedHold'),
        lines: previewPayload,
        customerId: selectedCustomer?.id || null,
      }).unwrap();
      toast.success(t('pos.holdSuccess'));
      resetSaleState();
      await refetchHoldCarts();
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.holdFailed')));
    }
  }

  async function handleResumeHold(holdCartId) {
    try {
      const cart = await resumeHoldCart(holdCartId).unwrap();
      setCartLines(cart.lines.map(buildCartLineFromHold));
      setActiveHoldCartId(cart.id);
      setSaleLabel(cart.label || t('pos.resumedHold'));
      setSelectedCustomer(
        cart.customer ? { id: cart.customer.id, name: cart.customer.name, phone: null } : null
      );
      setHoldDrawerOpen(false);
      toast.success(t('pos.resumeSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.resumeFailed')));
    }
  }

  async function handleDiscardHold(holdCartId) {
    try {
      await cancelHoldCart(holdCartId).unwrap();
      toast.success(t('pos.discardSuccess'));
      await refetchHoldCarts();
    } catch (error) {
      toast.error(getErrorMessage(error, t('pos.errors.discardFailed')));
    }
  }

  completeSaleRef.current = handleCompleteSale;
  holdActionRef.current = handleHoldAction;

  if (!canSell) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <POSNavbar
        saleLabel={saleLabel || (activeHoldCartId ? t('pos.resumedHold') : t('pos.draftSale'))}
        onHoldClick={handleHoldAction}
        canHoldCart={canHoldCart}
        registerSession={registerSession}
        currentUserId={user?.id}
        onRegisterClick={() => setRegisterModalOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <POSCartPanel
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSearchSubmit={handleSearchSubmit}
          isSearching={isSearching}
          searchInputRef={searchInputRef}
          cartLines={displayLines}
          onIncrease={(variantId) => updateQuantity(variantId, 1)}
          onDecrease={(variantId) => updateQuantity(variantId, -1)}
          onRemove={removeLine}
          saleLabel={saleLabel || t('pos.draftSale')}
          selectedCustomer={canPickCustomers ? selectedCustomer : null}
          onCustomerSelect={canPickCustomers ? setSelectedCustomer : undefined}
          canManageCustomers={canManageCustomers}
          canPickCustomers={canPickCustomers}
        />
        <POSPaymentPanel
          totals={totals}
          taxRateLabel={taxRateLabel}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          tenderedInput={tenderedInput}
          onTenderedInputChange={setTenderedInput}
          changeAmount={changeAmount}
          onCompleteSale={handleCompleteSale}
          isCompleting={isCompleting || isHolding}
          isPreviewLoading={isPreviewLoading}
          canCheckout={canCheckout}
          registerBlocked={!isRegisterOpen || !isRegisterOwner}
        />
      </div>
      <POSHoldCartDrawer
        open={holdDrawerOpen}
        carts={holdCarts}
        onClose={() => setHoldDrawerOpen(false)}
        onResume={handleResumeHold}
        onDiscard={handleDiscardHold}
        isLoading={isHoldCartsLoading}
      />
      <CashRegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        session={registerSession}
        currentUserId={user?.id}
        canManage={canManageRegister}
        onSessionChanged={refetchRegisterSession}
      />
    </div>
  );
}
