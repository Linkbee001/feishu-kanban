/**
 * GroupConfigPage - Group project configuration page
 * Single-page form with sections: chat sync, auto-fill display, minimal form
 * Includes validation, error handling, and success states
 */

import { useState } from 'react';
import { useGroupSync, useCompleteConfig } from '../hooks/useGroupConfig';
import { GroupConfigForm } from '../types/group-config';
import { isRequired, isValidUrl, isValidChatId } from '../utils/validation';
import { RefreshCw, Users, User, Check, AlertCircle, CheckCircle } from 'lucide-react';

const defaultForm: GroupConfigForm = {
  chatId: '',
  projectName: '',
  description: '',
  repoUrl: '',
  repoBranch: 'main',
  modelName: '',
  mentionOnly: true,
  allowedSkills: [],
  enabled: true,
};

export function GroupConfigPage() {
  const [chatIdInput, setChatIdInput] = useState('');
  const [form, setForm] = useState<GroupConfigForm>(defaultForm);
  const [isSynced, setIsSynced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    chatId?: string;
    projectName?: string;
    repoUrl?: string;
  }>({});

  const { sync, loading: syncLoading, error: syncError, data: groupInfo, clearError: clearSyncError } = useGroupSync();
  const { complete, loading: submitLoading, error: submitError, success, reset } = useCompleteConfig();

  const validateChatId = (value: string): boolean => {
    if (!isRequired(value)) {
      setValidationErrors(prev => ({ ...prev, chatId: '请输入群 ID' }));
      return false;
    }
    if (!isValidChatId(value)) {
      setValidationErrors(prev => ({ ...prev, chatId: '群 ID 格式不正确（应以 oc_ 开头）' }));
      return false;
    }
    setValidationErrors(prev => ({ ...prev, chatId: undefined }));
    return true;
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};
    let isValid = true;

    if (!isRequired(form.projectName)) {
      errors.projectName = '请输入项目名称';
      isValid = false;
    }

    if (form.repoUrl && !isValidUrl(form.repoUrl)) {
      errors.repoUrl = '请输入有效的 URL（以 http:// 或 https:// 开头）';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSync = async () => {
    if (!validateChatId(chatIdInput)) return;
    try {
      const info = await sync(chatIdInput.trim());
      setForm(prev => ({ ...prev, chatId: info.chatId, projectName: info.chatName }));
      setIsSynced(true);
    } catch {
      setIsSynced(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!groupInfo) return;
    await complete(form.chatId, groupInfo.ownerOpenId, form);
  };

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-ink">群项目配置</h2>
        <p className="text-sm text-muted mt-1">输入群 ID 并同步信息，完成项目配置</p>
      </div>

      {/* Section 1: Chat ID Sync */}
      <div className="mt-6">
        <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</span>
          输入群 ID
        </h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={chatIdInput}
              onChange={(e) => {
                setChatIdInput(e.target.value);
                if (validationErrors.chatId) {
                  setValidationErrors(prev => ({ ...prev, chatId: undefined }));
                }
                if (syncError) clearSyncError();
              }}
              placeholder="输入飞书群 chatId（如 oc_a67d8bf658d58e65a7e63f153a693540）"
              className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${
                validationErrors.chatId || syncError ? 'border-danger' : 'border-gray-200'
              }`}
              disabled={syncLoading || success}
            />
            {(validationErrors.chatId || syncError) && (
              <div className="mt-2">
                <p className="text-sm text-danger flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.chatId || (syncError?.message ?? '')}
                </p>
                {syncError && (
                  <button
                    onClick={() => {
                      clearSyncError();
                      handleSync();
                    }}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    重试同步
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncLoading || !chatIdInput.trim()}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? '同步中...' : '同步群信息'}
          </button>
        </div>
      </div>

      {/* Section 2: Auto-filled Info */}
      {isSynced && groupInfo && !success && (
        <div className="mt-6">
          <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
            群信息（已同步）
          </h3>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted" />
              <div>
                <p className="text-sm text-muted">群名称</p>
                <p className="font-medium text-ink">{groupInfo.chatName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted" />
              <div>
                <p className="text-sm text-muted">成员数量</p>
                <p className="font-medium text-ink">{groupInfo.memberCount} 人</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted" />
              <div>
                <p className="text-sm text-muted">管理员</p>
                <p className="font-medium text-ink">{groupInfo.ownerOpenId.slice(0, 16)}...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Minimal Form */}
      {isSynced && !success && (
        <div className="mt-6">
          <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">3</span>
            项目配置
          </h3>
          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                项目名称 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.projectName}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, projectName: e.target.value }));
                  if (validationErrors.projectName) {
                    setValidationErrors(prev => ({ ...prev, projectName: undefined }));
                  }
                }}
                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${
                  validationErrors.projectName ? 'border-danger' : 'border-gray-200'
                }`}
                placeholder="项目名称"
              />
              {validationErrors.projectName && (
                <p className="mt-2 text-sm text-danger flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.projectName}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">默认使用群名称，可修改</p>
            </div>

            {/* Repo URL (Optional) */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                代码仓库地址
                <span className="text-muted ml-1">(可选)</span>
              </label>
              <input
                type="text"
                value={form.repoUrl}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, repoUrl: e.target.value }));
                  if (validationErrors.repoUrl) {
                    setValidationErrors(prev => ({ ...prev, repoUrl: undefined }));
                  }
                }}
                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${
                  validationErrors.repoUrl ? 'border-danger' : 'border-gray-200'
                }`}
                placeholder="https://github.com/owner/repo"
              />
              {validationErrors.repoUrl && (
                <p className="mt-2 text-sm text-danger flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.repoUrl}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">如需代码功能，填写 Git 仓库地址</p>
            </div>

            {/* Hidden defaults displayed as summary */}
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-muted">
              <p>其他配置使用默认值：</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>分支: main</li>
                <li>模型: 默认</li>
                <li>策略: @mention 触发</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Submit */}
      {isSynced && !success && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          {submitError && (
            <div className="mb-3">
              <p className="text-sm text-danger flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {submitError.message}
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="mt-2 text-sm text-primary hover:underline"
              >
                重新提交
              </button>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitLoading || !form.projectName.trim()}
            className="w-full px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {submitLoading ? '配置中...' : '完成配置'}
          </button>
        </div>
      )}

      {/* Success Section */}
      {success && (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 text-lg">配置完成！</h3>
              <p className="text-green-600 mt-1">
                群 <span className="font-medium">{groupInfo?.chatName}</span> 已成功配置
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.location.href = '/admin'}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              返回 Dashboard
            </button>
            <button
              onClick={() => {
                setChatIdInput('');
                setForm(defaultForm);
                setIsSynced(false);
                reset();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
            >
              配置另一个群
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-green-100 text-sm text-green-700">
            <p>配置摘要：</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>项目名称: {form.projectName}</li>
              {form.repoUrl && <li>代码仓库: {form.repoUrl}</li>}
              <li>成员数: {groupInfo?.memberCount} 人</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
