import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '@/hooks/useApi';
import {
  GroupFullConfig,
  GroupInfo,
  InitializeProjectRequest,
  UpdateConfigRequest,
} from '@/types/group-config';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

interface GroupConfigDrawerProps {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

type DrawerPhase = 'loading' | 'syncing' | 'init-form' | 'active' | 'success';

function generateConfigMarkdown(form: InitializeProjectRequest): string {
  return `## Project
- Name: ${form.projectName}
- Description: ${form.description || ''}
- Status: pending

## Environment
- Name: 默认主环境
- Repo URL: ${form.repoUrl || ''}
- Branch: ${form.repoBranch || 'main'}
- Model: ${form.modelName || 'claude-3-5-sonnet'}

## Policy
- Enabled: true
- Mention Only: true

## Skills
- gsd:capture
- gsd:discuss-phase
- gsd:plan-phase
- gsd:execute-phase
- gsd:verify-work

## Memory

`;
}

export function GroupConfigDrawer({
  groupId,
  open,
  onOpenChange,
  onSaved,
}: GroupConfigDrawerProps) {
  const [phase, setPhase] = useState<DrawerPhase>('loading');
  const [saving, setSaving] = useState(false);
  const [configData, setConfigData] = useState<GroupFullConfig | null>(null);

  // Form state for pending_config initialization
  const [initForm, setInitForm] = useState<InitializeProjectRequest>({
    projectName: '',
    ownerOpenId: '',
  });

  // Form state for active config editing
  const [editForm, setEditForm] = useState<UpdateConfigRequest>({});

  const fetchFullConfig = useCallback(async () => {
    if (!groupId) return;
    setPhase('loading');
    try {
      const data = await apiGet<GroupFullConfig>(`/group-config/${groupId}/full`);
      setConfigData(data);

      if (data.sessionMode === 'pending_config' || data.sessionMode === 'bootstrap') {
        // Need to sync to get group info
        await syncGroupInfo();
      } else if (data.sessionMode === 'active') {
        // Populate edit form
        setEditForm({
          projectName: data.projectName,
          projectDescription: data.projectDescription,
          customPrompt: data.customPrompt,
          policy: {
            enabled: data.policy.enabled,
            mentionOnly: data.policy.mentionOnly,
          },
          environment: {
            repoUrl: data.environment.repoUrl,
            repoBranch: data.environment.repoBranch,
            modelName: data.environment.modelName,
          },
        });
        setPhase('active');
      }
    } catch (error) {
      toast.error('Failed to load group config');
      setPhase('loading');
    }
  }, [groupId]);

  const syncGroupInfo = useCallback(async () => {
    if (!groupId) return;
    setPhase('syncing');
    try {
      const syncData = await apiPost<GroupInfo>(`/group-config/${groupId}/sync`, {});
      setInitForm({
        projectName: syncData.chatName || groupId,
        ownerOpenId: syncData.ownerOpenId,
        description: '',
      });
      setPhase('init-form');
    } catch (error) {
      toast.error('Failed to sync group info from Feishu');
      setPhase('loading');
    }
  }, [groupId]);

  useEffect(() => {
    if (open && groupId) {
      fetchFullConfig();
    }
  }, [open, groupId, fetchFullConfig]);

  const handleInitialize = async () => {
    if (!groupId) return;
    if (!initForm.projectName.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSaving(true);
    try {
      const configMarkdown = generateConfigMarkdown(initForm);
      await apiPost(`/group-config/${groupId}/complete`, {
        ownerOpenId: initForm.ownerOpenId,
        configMarkdown,
      });
      toast.success('Project initialized successfully');
      setPhase('success');
      onSaved?.();
      setTimeout(() => onOpenChange(false), 1500);
    } catch (error) {
      toast.error('Failed to initialize project');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      await apiPatch(`/group-config/${groupId}`, editForm);
      toast.success('Configuration saved');
      setPhase('success');
      onSaved?.();
      setTimeout(() => onOpenChange(false), 1500);
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!groupId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-[500px]">
        {/* Loading state */}
        {phase === 'loading' && (
          <>
            <DrawerHeader>
              <DrawerTitle>Loading Configuration</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 py-4 space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-24 w-full" />
            </div>
          </>
        )}

        {/* Syncing state */}
        {phase === 'syncing' && (
          <>
            <DrawerHeader>
              <DrawerTitle>Syncing Group Info</DrawerTitle>
              <DrawerDescription>
                Fetching group details from Feishu...
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 py-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        )}

        {/* Initialize Project Form (pending_config) */}
        {phase === 'init-form' && (
          <>
            <DrawerHeader>
              <DrawerTitle>Initialize Project</DrawerTitle>
              <DrawerDescription>
                Create a new project for this Feishu group
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 py-4 space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name *</Label>
                <Input
                  id="projectName"
                  value={initForm.projectName}
                  onChange={(e) =>
                    setInitForm((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                  placeholder="Enter project name..."
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={initForm.description || ''}
                  onChange={(e) =>
                    setInitForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief project description..."
                />
              </div>

              {/* Repo URL */}
              <div className="space-y-2">
                <Label htmlFor="repoUrl">Repository URL</Label>
                <Input
                  id="repoUrl"
                  value={initForm.repoUrl || ''}
                  onChange={(e) =>
                    setInitForm((prev) => ({ ...prev, repoUrl: e.target.value }))
                  }
                  placeholder="https://github.com/org/repo"
                />
              </div>

              {/* Branch and Model */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repoBranch">Branch</Label>
                  <Input
                    id="repoBranch"
                    value={initForm.repoBranch || 'main'}
                    onChange={(e) =>
                      setInitForm((prev) => ({ ...prev, repoBranch: e.target.value }))
                    }
                    placeholder="main"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelName">Model</Label>
                  <Input
                    id="modelName"
                    value={initForm.modelName || ''}
                    onChange={(e) =>
                      setInitForm((prev) => ({ ...prev, modelName: e.target.value }))
                    }
                    placeholder="claude-3-5-sonnet"
                  />
                </div>
              </div>
            </div>

            <DrawerFooter className="flex-row justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                onClick={handleInitialize}
                disabled={saving || !initForm.projectName.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  'Initialize Project'
                )}
              </Button>
            </DrawerFooter>
          </>
        )}

        {/* Edit Config Form (active) */}
        {phase === 'active' && (
          <>
            <DrawerHeader>
              <DrawerTitle>Edit Configuration</DrawerTitle>
              <DrawerDescription>
                Modify project settings and AI behavior
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 py-4 space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={editForm.projectName || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, projectName: e.target.value }))
                  }
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.projectDescription || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      projectDescription: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <Label htmlFor="customPrompt">System Prompt</Label>
                <Textarea
                  id="customPrompt"
                  value={editForm.customPrompt || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, customPrompt: e.target.value }))
                  }
                  className="min-h-[120px]"
                  placeholder="Custom instructions for AI behavior..."
                />
              </div>

              {/* Policy switches */}
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="cursor-pointer">
                  Agent Enabled
                </Label>
                <Switch
                  id="enabled"
                  checked={editForm.policy?.enabled ?? true}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({
                      ...prev,
                      policy: { ...prev.policy, enabled: checked },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="mentionOnly" className="cursor-pointer">
                  Respond Only to Mentions
                </Label>
                <Switch
                  id="mentionOnly"
                  checked={editForm.policy?.mentionOnly ?? true}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({
                      ...prev,
                      policy: { ...prev.policy, mentionOnly: checked },
                    }))
                  }
                />
              </div>

              {/* Repo settings */}
              <div className="space-y-2">
                <Label>Repository Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Repo URL"
                    value={editForm.environment?.repoUrl || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        environment: { ...prev.environment, repoUrl: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder="Branch"
                    value={editForm.environment?.repoBranch || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        environment: { ...prev.environment, repoBranch: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <DrawerFooter className="flex-row justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button onClick={handleSaveChanges} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DrawerFooter>
          </>
        )}

        {/* Success state */}
        {phase === 'success' && (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Success
              </DrawerTitle>
              <DrawerDescription>
                {configData?.sessionMode === 'active'
                  ? 'Configuration saved successfully'
                  : 'Project initialized successfully'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 py-8 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}