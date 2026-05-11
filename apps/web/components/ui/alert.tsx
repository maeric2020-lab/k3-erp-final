import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:ps-8 [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive bg-destructive/5 [&>svg]:text-destructive',
        success: 'border-green-600/40 bg-green-500/5 text-green-700 dark:text-green-400 [&>svg]:text-green-600',
        info: 'border-primary/40 bg-primary/5 text-primary [&>svg]:text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  showIcon?: boolean;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, showIcon = true, children, ...props }, ref) => {
    const Icon =
      variant === 'destructive' ? AlertCircle : variant === 'success' ? CheckCircle2 : Info;
    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        {showIcon ? <Icon className="h-4 w-4" /> : null}
        {children}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';
