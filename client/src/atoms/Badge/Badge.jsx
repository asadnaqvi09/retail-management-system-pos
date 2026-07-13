import { cn } from '../../lib/utils';

export default function Badge({ className, children, variant = 'default' }) {
  const variants = {
    default: 'bg-[#eef2ff] text-primary',
    success: 'bg-[#f0fdf4] text-success',
    warning: 'bg-[#fef3c7] text-warning',
    danger: 'bg-[#fef2f2] text-danger',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
