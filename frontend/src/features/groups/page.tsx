import { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { GroupTable } from './components/group-table';
import { GroupFilters } from './components/group-filters';
import { GroupConfigDrawer } from './group-config-drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useGroups } from '@/hooks/useGroups';
import { toast } from 'sonner';

export function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [unbindingGroupId, setUnbindingGroupId] = useState<string | null>(null);

  const { groups, total, loading, error, refetch, unbind } = useGroups({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : (statusFilter as 'bound' | 'pending_config' | 'unbound'),
    page,
    limit,
  });

  // Handle drawer from URL params
  useEffect(() => {
    const drawer = searchParams.get('drawer');
    const chatId = searchParams.get('chatId');
    if (drawer === 'group-config' && chatId) {
      setSelectedGroupId(chatId);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleConfigure = useCallback((chatId: string) => {
    setSelectedGroupId(chatId);
    setSearchParams({ drawer: 'group-config', chatId });
    setDrawerOpen(true);
  }, [setSearchParams]);

  const handleDrawerClose = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setSearchParams({});
      setSelectedGroupId(null);
    }
  }, [setSearchParams]);

  const handleDrawerSaved = useCallback(() => {
    refetch();
    handleDrawerClose(false);
    toast.success('Group configuration saved');
  }, [refetch, handleDrawerClose]);

  const handleUnbind = useCallback((chatId: string) => {
    setUnbindingGroupId(chatId);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmUnbind = useCallback(async () => {
    if (!unbindingGroupId) return;
    try {
      await unbind(unbindingGroupId);
      toast.success('Group unbound successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to unbind group');
    } finally {
      setConfirmDialogOpen(false);
      setUnbindingGroupId(null);
    }
  }, [unbindingGroupId, unbind, refetch]);

  const handleAddGroup = useCallback(() => {
    toast.info('Groups are created automatically when the robot joins a Feishu chat. Add the robot to a group to bind it.');
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
          <p className="text-muted-foreground">
            Manage your Feishu groups and configurations
          </p>
        </div>
        <Button onClick={handleAddGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </div>

      {/* Filters */}
      <GroupFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Table or Empty State */}
      {groups.length === 0 && !loading && !searchQuery && statusFilter === 'all' ? (
        <EmptyState
          title="No groups found"
          description="Get started by adding your first group"
          action={{
            label: 'Add Group',
            onClick: handleAddGroup,
          }}
        />
      ) : (
        <GroupTable
          groups={groups}
          loading={loading}
          error={error}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          onConfigure={handleConfigure}
          onUnbind={handleUnbind}
        />
      )}

      {/* Group Config Drawer */}
      <GroupConfigDrawer
        groupId={selectedGroupId}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        onSaved={handleDrawerSaved}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Unbind Group"
        description="Are you sure you want to unbind this group? This action cannot be undone."
        onConfirm={handleConfirmUnbind}
        confirmText="Unbind"
        confirmVariant="destructive"
        loading={false}
      />
    </div>
  );
}
