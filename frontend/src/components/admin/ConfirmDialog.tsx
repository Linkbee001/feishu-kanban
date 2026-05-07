/**
 * ConfirmDialog component
 * Radix AlertDialog wrapper for confirmation dialogs
 * Implements D-03: Dangerous operations require Modal confirmation popup
 */

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  children: React.ReactNode; // Trigger element (button)
}

/**
 * ConfirmDialog displays a confirmation modal with overlay
 * - Title and description customizable
 * - Cancel and Confirm buttons present
 * - Confirm button triggers onConfirm callback
 * - Dialog closes after confirmation (controlled state)
 * - Uses Radix AlertDialog primitives
 * - Focus trap and keyboard navigation handled by Radix
 */
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'danger',
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false); // Close after action completes
  };

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-danger text-white'
      : 'bg-primary text-white';

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />
        <AlertDialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl max-w-md"
        >
          <AlertDialog.Title className="text-lg font-semibold text-ink">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted mt-2">
            {description}
          </AlertDialog.Description>
          <div className="mt-4 flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 rounded border border-gray-200 text-ink hover:bg-gray-50">
                {cancelText}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                className={`px-4 py-2 rounded ${confirmButtonClass} hover:opacity-80`}
                onClick={handleConfirm}
              >
                {confirmText}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}