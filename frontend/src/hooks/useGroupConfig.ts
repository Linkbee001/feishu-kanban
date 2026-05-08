import { useState, useCallback } from 'react';
import { GroupInfo, GroupConfigForm } from '../types/group-config';

function generateConfigMarkdown(form: GroupConfigForm): string {
  return `# PROJECT-CONFIG

## Basic
- project.name: ${form.projectName}
- project.description: ${form.description || 'N/A'}

## Environment
- repo.url: ${form.repoUrl || 'N/A'}
- repo.branch: ${form.repoBranch || 'main'}
- model.name: ${form.modelName || 'default'}

## Policy
- mentionOnly: ${form.mentionOnly}
- allowedSkills: ${form.allowedSkills.join(', ') || 'all'}
- enabled: ${form.enabled}`;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.message || data.error || `错误 ${response.status}`;
  } catch {
    return `请求失败 (${response.status})`;
  }
}

export function useGroupSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<GroupInfo | null>(null);

  const sync = useCallback(async (chatId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/group-config/${encodeURIComponent(chatId)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }
      const result = await response.json();
      setData(result);
      return result as GroupInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(new Error(message));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { sync, loading, error, data, clearError };
}

export function useCompleteConfig() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const complete = useCallback(async (
    chatId: string,
    ownerOpenId: string,
    form: GroupConfigForm
  ) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const configMarkdown = generateConfigMarkdown(form);
      const response = await fetch(`/api/group-config/${encodeURIComponent(chatId)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerOpenId, configMarkdown }),
      });
      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }
      setSuccess(true);
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(new Error(message));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { complete, loading, error, success, reset, clearError };
}
