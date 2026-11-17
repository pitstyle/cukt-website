import { setPlainText } from './plain-text.ts';

export const HEALTH_TIMEOUT_MS = 4_000;
export const HEALTH_POLL_MS = 30_000;

export type HealthState = 'connecting' | 'online' | 'offline';

export const STATUS_LABELS: Record<HealthState, { en: string; pl: string }> = {
  connecting: { en: '● CONNECTING', pl: '● łączenie' },
  online: { en: '● ONLINE', pl: '● ONLINE' },
  offline: { en: '● OFFLINE', pl: '● OFFLINE' },
};

export const OFFLINE_NOTICE = {
  en: 'System offline — try again later',
  pl: 'System offline — spróbuj później',
};

export type CheckHealthOptions = {
  chatApi: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export function healthUrl(chatApi: string): string {
  return `${chatApi.replace(/\/$/, '')}/health`;
}

/**
 * GET /health — online only when HTTP 200 and JSON.status === "ok".
 */
export async function checkAgentHealth(opts: CheckHealthOptions): Promise<boolean> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? HEALTH_TIMEOUT_MS;
  const url = healthUrl(opts.chatApi);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) {
      return false;
    }
    opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!res.ok) return false;

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return false;
    }
    if (!data || typeof data !== 'object') return false;
    return (data as { status?: unknown }).status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export type HealthUiTargets = {
  statusEl: { textContent: string | null; setAttribute(name: string, value: string): void };
  input?: { disabled: boolean } | null;
  sendBtn?: { disabled: boolean } | null;
  offlineMsg?: {
    hidden: boolean;
    textContent: string | null;
    setAttribute?(name: string, value: string): void;
    getAttribute?(name: string): string | null;
  } | null;
  sending?: boolean;
  lang?: string;
};

export function applyHealthUi(state: HealthState, targets: HealthUiTargets): void {
  const labels = STATUS_LABELS[state];
  targets.statusEl.setAttribute('data-state', state);
  targets.statusEl.setAttribute('data-en', labels.en);
  targets.statusEl.setAttribute('data-pl', labels.pl);

  const lang = targets.lang ?? 'en';
  setPlainText(targets.statusEl, lang === 'pl' ? labels.pl : labels.en);

  const isOnline = state === 'online';
  if (targets.input) targets.input.disabled = !isOnline;
  if (targets.sendBtn) targets.sendBtn.disabled = !isOnline || Boolean(targets.sending);

  if (targets.offlineMsg) {
    targets.offlineMsg.hidden = state !== 'offline';
    if (state === 'offline') {
      const notice = lang === 'pl' ? OFFLINE_NOTICE.pl : OFFLINE_NOTICE.en;
      setPlainText(targets.offlineMsg, notice);
    }
  }
}
