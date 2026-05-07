/**
 * Admin UI TypeScript types
 * Temporary verification file to confirm module resolution
 */

// Verify TanStack Table imports
import { ColumnDef } from '@tanstack/react-table';

// Verify Radix UI AlertDialog imports
import * as AlertDialog from '@radix-ui/react-alert-dialog';

// Verify Lucide React icons
import { RefreshCw } from 'lucide-react';

// Export a dummy type to confirm TanStack Table types resolve correctly
export type TestTableColumn = ColumnDef<{ id: string }>;

// Export dummy components to confirm Radix UI imports work
export const TestAlertDialog = AlertDialog.Root;

// Export dummy icon to confirm Lucide React imports work
export const TestRefreshIcon = RefreshCw;