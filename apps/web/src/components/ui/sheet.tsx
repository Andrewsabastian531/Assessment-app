'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'left' | 'right';
  }
>(({ className, children, side = 'left', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="bg-ink-900/30 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'shadow-pop fixed inset-y-0 z-50 flex w-[264px] flex-col bg-white transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
        side === 'left'
          ? 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left left-0'
          : 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0',
        'data-[state=closed]:animate-out data-[state=open]:animate-in',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 absolute right-3 top-3 rounded-md p-1 transition-colors">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
