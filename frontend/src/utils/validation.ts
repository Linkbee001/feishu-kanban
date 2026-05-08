export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidUrl(url: string): boolean {
  if (!url.trim()) return true; // optional field
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidChatId(chatId: string): boolean {
  // ChatId format: oc_xxxxxxxxxxxxxxxx (typically 32+ chars after oc_)
  return /^oc_[a-z0-9]{20,}$/.test(chatId.trim());
}
