import { useState, useEffect, useCallback } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/hooks/useApi';

interface SystemSettings {
  feishuAppId: string;
  feishuAppSecret: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  notificationsEnabled: boolean;
  debugMode: boolean;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    feishuAppId: '',
    feishuAppSecret: '',
    defaultModel: 'gpt-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    notificationsEnabled: true,
    debugMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<SystemSettings>('/admin/settings');
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch('/admin/settings', settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof SystemSettings, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage system configuration</p>
        </div>
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage system configuration</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Feishu Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Feishu Configuration
            </CardTitle>
            <CardDescription>Configure Feishu app credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                value={settings.feishuAppId}
                onChange={(e) => handleChange('feishuAppId', e.target.value)}
                placeholder="Enter Feishu App ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="appSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={settings.feishuAppSecret}
                  onChange={(e) => handleChange('feishuAppSecret', e.target.value)}
                  placeholder="Enter Feishu App Secret"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>Default AI model settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Default Model</Label>
              <Input
                id="model"
                value={settings.defaultModel}
                onChange={(e) => handleChange('defaultModel', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Default Temperature</Label>
              <Input
                id="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settings.defaultTemperature}
                onChange={(e) => handleChange('defaultTemperature', parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Default Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={1}
                value={settings.defaultMaxTokens}
                onChange={(e) => handleChange('defaultMaxTokens', parseInt(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>System Preferences</CardTitle>
            <CardDescription>System behavior settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notifications" className="cursor-pointer">
                  Enable Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for important events
                </p>
              </div>
              <Switch
                id="notifications"
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => handleChange('notificationsEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="debug" className="cursor-pointer">
                  Debug Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable detailed logging for debugging
                </p>
              </div>
              <Switch
                id="debug"
                checked={settings.debugMode}
                onCheckedChange={(checked) => handleChange('debugMode', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
