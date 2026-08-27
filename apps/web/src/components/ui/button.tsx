import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // The primary CTA in the design is a solid near-black pill.
        primary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400',
        brand: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-200',
        outline: 'border border-ink-200 bg-white text-ink-900 hover:bg-ink-50',
        ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        link: 'text-brand-500 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9',
      },
      shape: {
        pill: 'rounded-full',
        rounded: 'rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', shape: 'pill' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, shape }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
