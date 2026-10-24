import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-px',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border border-primary shadow-sm hover:brightness-95',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm border-destructive-border',
        outline: 'border border-border bg-card text-foreground shadow-sm hover:bg-secondary',
        secondary: 'border border-border bg-secondary text-secondary-foreground hover:brightness-95',
        ghost: 'border border-transparent hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline hover:translate-y-0',
      },
      size: {
        // @replit changed sizes
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 rounded-lg px-3 text-xs',
        lg: 'min-h-11 rounded-lg px-8',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
