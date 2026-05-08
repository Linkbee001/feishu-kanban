/**
 * Drawer component - Generic slide-over panel
 * Uses Radix Dialog for accessibility (focus trap, ESC key)
 * Implements UI-SPEC: 480px width, right position, 300ms animation
 */

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Drawer displays a slide-over panel from the right edge
 * - Width: 480px fixed per UI-SPEC
 * - Overlay: rgba(0,0,0,0.3) backdrop with blur
 * - Animation: 300ms ease-out slide from right
 * - Close: X button, overlay click, ESC key
 * - Focus trap and keyboard navigation handled by Radix
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay with backdrop blur */}
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content panel - right-aligned, 480px width */}
        <Dialog.Content
          className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300 ease-out flex flex-col"
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-[20px] font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </Dialog.Close>
          </div>

          {/* Optional description */}
          {description && (
            <Dialog.Description className="px-6 py-2 text-sm text-muted">
              {description}
            </Dialog.Description>
          )}

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}