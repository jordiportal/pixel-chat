export interface BrainConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'pixel-chat-config';

// Permitir override via variable global para Docker
const RUNTIME_API_URL = (typeof window !== 'undefined' && (window as any).__BRAIN_API_URL__) || '';

const DEFAULTS: BrainConfig = {
  apiUrl: RUNTIME_API_URL || 'http://localhost:8000',
  apiKey: '',
  model: 'brain-adaptive',
};

export function getConfig(): BrainConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveConfig(patch: Partial<BrainConfig>): void {
  const merged = { ...getConfig(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
