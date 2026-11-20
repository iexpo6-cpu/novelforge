const STORAGE_KEY = 'novelforge_custom_gemini_api_key';

export function getCustomGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) || '';
}

export function setCustomGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function buildAIHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const customKey = getCustomGeminiKey();
  if (customKey) {
    headers['x-gemini-api-key'] = customKey;
  }
  return headers;
}
