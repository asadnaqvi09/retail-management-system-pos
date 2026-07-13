import { Delete } from 'lucide-react';
import { cn } from '../../lib/utils';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

export default function POSNumpad({ value, onChange, disabled }) {
  function handleKey(key) {
    if (disabled) return;
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) {
      return;
    }
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    onChange(`${value}${key}`);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => handleKey(key)}
          className={cn(
            'flex h-12 items-center justify-center rounded-xl border border-border bg-white text-[18px] font-medium transition-colors',
            'hover:bg-[#f4f4f8] disabled:cursor-not-allowed disabled:opacity-50',
            key === 'backspace' && 'text-muted'
          )}
        >
          {key === 'backspace' ? <Delete size={18} /> : key}
        </button>
      ))}
    </div>
  );
}
