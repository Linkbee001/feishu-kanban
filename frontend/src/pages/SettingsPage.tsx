import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle } from 'lucide-react';
import { useApi, apiPost } from '../hooks/useApi';

interface Settings {
  defaultModel: string;
  autoSyncGroups: boolean;
  messageRetentionDays: number;
  emailNotifications: boolean;
  notificationEmail: string;
}

// Available models
const AVAILABLE_MODELS = [
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

// Toggle component
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Toast notification component
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 px-4 py-3 rounded-xl shadow-lg z-50 ${
        type === 'success'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-danger'
      }`}
    >
      <div className="flex items-center gap-2">
        {type === 'success' && <CheckCircle className="w-5 h-5" />}
        <span>{message}</span>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { data: initialSettings, loading, error } = useApi<Settings>('/api/admin/settings');
  const [settings, setSettings] = useState<Settings>({
    defaultModel: 'claude-3-5-sonnet',
    autoSyncGroups: true,
    messageRetentionDays: 30,
    emailNotifications: false,
    notificationEmail: '',
  });
  const [originalSettings, setOriginalSettings] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load initial settings
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setOriginalSettings(initialSettings);
    }
  }, [initialSettings]);

  // Check if settings have changed
  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // Handle settings change
  const handleChange = (key: keyof Settings, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Save settings
  const handleSave = async () => {
    if (!isDirty) return;

    // Validate email if notifications enabled
    if (settings.emailNotifications && settings.notificationEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.notificationEmail)) {
        setToast({ message: '请输入有效的邮箱地址', type: 'error' });
        return;
      }
    }

    // Validate retention days
    if (settings.messageRetentionDays < 1 || settings.messageRetentionDays > 365) {
      setToast({ message: '消息保留天数应在 1-365 之间', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const result = await apiPost<Settings>('/api/admin/settings', settings);
      setSettings(result);
      setOriginalSettings(result);
      setToast({ message: '设置已保存', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败，请重试';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    setSettings(originalSettings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-ink flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            系统设置
          </h1>
          <p className="text-sm text-muted mt-1">系统配置</p>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger">
          加载失败，请刷新重试
        </div>
      )}

      {/* Loading state */}
      {loading && !initialSettings && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Settings form */}
      {!loading && (
        <>
          {/* General Settings Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">通用设置</h2>
            <div className="space-y-4">
              {/* Default model */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <label className="text-sm font-medium text-ink">默认模型</label>
                  <p className="text-xs text-muted mt-1">AI 任务执行使用的默认模型</p>
                </div>
                <select
                  value={settings.defaultModel}
                  onChange={(e) => handleChange('defaultModel', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto sync groups */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <label className="text-sm font-medium text-ink">自动同步群信息</label>
                  <p className="text-xs text-muted mt-1">自动同步群成员和配置信息</p>
                </div>
                <Toggle
                  checked={settings.autoSyncGroups}
                  onChange={(checked) => handleChange('autoSyncGroups', checked)}
                />
              </div>

              {/* Message retention days */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <label className="text-sm font-medium text-ink">消息保留天数</label>
                  <p className="text-xs text-muted mt-1">历史消息的保留期限</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.messageRetentionDays}
                  onChange={(e) => handleChange('messageRetentionDays', parseInt(e.target.value, 10) || 30)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-24"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">通知设置</h2>
            <div className="space-y-4">
              {/* Enable email notifications */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <label className="text-sm font-medium text-ink">启用邮件通知</label>
                  <p className="text-xs text-muted mt-1">接收系统重要事件邮件通知</p>
                </div>
                <Toggle
                  checked={settings.emailNotifications}
                  onChange={(checked) => handleChange('emailNotifications', checked)}
                />
              </div>

              {/* Notification email */}
              {settings.emailNotifications && (
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <div>
                    <label className="text-sm font-medium text-ink">通知邮箱</label>
                    <p className="text-xs text-muted mt-1">接收通知的邮箱地址</p>
                  </div>
                  <input
                    type="email"
                    value={settings.notificationEmail}
                    onChange={(e) => handleChange('notificationEmail', e.target.value)}
                    placeholder="example@email.com"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Save/Reset buttons */}
          <div className="flex items-center justify-end gap-3">
            {isDirty && (
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-muted hover:bg-panel transition-colors"
              >
                重置
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}