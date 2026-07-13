import { Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Badge from '../../atoms/Badge';
import { formatMoney } from '../../lib/format';

function formatAttributes(attributes) {
  if (!attributes?.length) return '';
  return attributes.map((item) => item.value).join(' / ');
}

export default function POSCartItem({ item, onIncrease, onDecrease, onRemove }) {
  const { t } = useTranslation();
  const attributesLabel = formatAttributes(item.attributes);
  const lineTotal = item.lineTotal ?? item.unitPrice * item.quantity;
  const promoLabel = item.promotionName || item.promotion?.name;

  return (
    <div className="flex gap-3 border-b border-border py-3 last:border-b-0">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.productName}
          className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-[#f4f4f8] text-[11px] font-medium text-muted">
          {t('pos.noImage')}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{item.productName}</p>
            <p className="text-[12px] text-muted">
              {item.sku}
              {attributesLabel ? ` · ${attributesLabel}` : ''}
            </p>
            <p className="text-[12px] text-muted">
              {formatMoney(item.unitPrice)} · {t('pos.stock')}: {item.stock}
            </p>
            {promoLabel ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="success">{promoLabel}</Badge>
                {item.promoDiscount > 0 ? (
                  <span className="text-[12px] text-success">
                    -{formatMoney(item.promoDiscount)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="shrink-0 text-[14px] font-semibold">{formatMoney(lineTotal)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onDecrease}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted hover:bg-[#f4f4f8]"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-[2rem] text-center text-[13px] font-medium">{item.quantity}</span>
            <button
              type="button"
              onClick={onIncrease}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted hover:bg-[#f4f4f8]"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-[#fef2f2] hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
