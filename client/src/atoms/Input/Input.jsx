import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border bg-white px-3 text-[14px] outline-none transition-colors placeholder:text-muted-foreground',
        error
          ? 'border-danger focus:border-danger'
          : 'border-border focus:border-primary',
        className
      )}
      {...props}
    />
  );
});

export default Input;
