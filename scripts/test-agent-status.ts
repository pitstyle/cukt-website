import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  OFFLINE_NOTICE,
  STATUS_LABELS,
  applyHealthUi,
  checkAgentHealth,
  healthUrl,
} from '../src/lib/agent-health.ts';

const CHAT_API = 'https://chat.example';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function makeStatusTargets(lang = 'en') {
  const attrs: Record<string, string> = {};
  const statusEl = {
    textContent: '' as string | null,
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
  };
  const input = { disabled: false };
  const sendBtn = { disabled: false };
  const offlineMsg = {
    hidden: true,
    textContent: '' as string | null,
  };
  return { statusEl, input, sendBtn, offlineMsg, lang, attrs };
}

describe('healthUrl', () => {
  it('joins chatApi and /health without a double slash', () => {
    assert.equal(healthUrl('https://chat.example'), 'https://chat.example/health');
    assert.equal(healthUrl('https://chat.example/'), 'https://chat.example/health');
  });
});

describe('checkAgentHealth', () => {
  it('returns true for HTTP 200 + {status:"ok"}', async () => {
    const calls: { url: string; method?: string; credentials?: RequestCredentials }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        credentials: init?.credentials as RequestCredentials | undefined,
      });
      return jsonResponse(200, {
        status: 'ok',
        service: 'cuktai-api',
        backend: 'hermes',
        llm_configured: true,
      });
    };

    const ok = await checkAgentHealth({ chatApi: CHAT_API, fetchImpl });
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${CHAT_API}/health`);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].credentials, 'omit');
  });

  it('does not require hermes or llm_configured', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(200, { status: 'ok', service: 'cuktai-api' });
    assert.equal(await checkAgentHealth({ chatApi: CHAT_API, fetchImpl }), true);
  });

  it('returns false on HTTP 503', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse(503, { status: 'ok' });
    assert.equal(await checkAgentHealth({ chatApi: CHAT_API, fetchImpl }), false);
  });

  it('returns false on non-JSON body', async () => {
    const fetchImpl: typeof fetch = async () => textResponse(200, 'not-json');
    assert.equal(await checkAgentHealth({ chatApi: CHAT_API, fetchImpl }), false);
  });

  it('returns false when status is not ok', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse(200, { status: 'down' });
    assert.equal(await checkAgentHealth({ chatApi: CHAT_API, fetchImpl }), false);
  });

  it('returns false when fetch rejects (network)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    assert.equal(await checkAgentHealth({ chatApi: CHAT_API, fetchImpl }), false);
  });

  it('returns false on timeout via AbortController', async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        if (!signal) {
          reject(new Error('missing signal'));
          return;
        }
        signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };
    const ok = await checkAgentHealth({
      chatApi: CHAT_API,
      fetchImpl,
      timeoutMs: 20,
    });
    assert.equal(ok, false);
  });
});

describe('applyHealthUi', () => {
  it('ONLINE enables the form and hides the offline notice', () => {
    const t = makeStatusTargets('en');
    applyHealthUi('online', t);
    assert.equal(t.statusEl.textContent, STATUS_LABELS.online.en);
    assert.equal(t.attrs['data-state'], 'online');
    assert.equal(t.attrs['data-en'], '● ONLINE');
    assert.equal(t.attrs['data-pl'], '● ONLINE');
    assert.equal(t.input.disabled, false);
    assert.equal(t.sendBtn.disabled, false);
    assert.equal(t.offlineMsg.hidden, true);
  });

  it('OFFLINE disables input/send and shows the notice', () => {
    const t = makeStatusTargets('en');
    applyHealthUi('offline', t);
    assert.equal(t.statusEl.textContent, STATUS_LABELS.offline.en);
    assert.equal(t.attrs['data-state'], 'offline');
    assert.equal(t.input.disabled, true);
    assert.equal(t.sendBtn.disabled, true);
    assert.equal(t.offlineMsg.hidden, false);
    assert.equal(t.offlineMsg.textContent, OFFLINE_NOTICE.en);
  });

  it('OFFLINE uses Polish notice when lang=pl', () => {
    const t = makeStatusTargets('pl');
    applyHealthUi('offline', t);
    assert.equal(t.statusEl.textContent, STATUS_LABELS.offline.pl);
    assert.equal(t.offlineMsg.textContent, OFFLINE_NOTICE.pl);
  });

  it('connecting dims status and keeps the form disabled', () => {
    const t = makeStatusTargets('pl');
    applyHealthUi('connecting', t);
    assert.equal(t.statusEl.textContent, STATUS_LABELS.connecting.pl);
    assert.equal(t.attrs['data-pl'], '● łączenie');
    assert.equal(t.attrs['data-en'], '● CONNECTING');
    assert.equal(t.input.disabled, true);
    assert.equal(t.sendBtn.disabled, true);
    assert.equal(t.offlineMsg.hidden, true);
  });

  it('recovers from OFFLINE to ONLINE', () => {
    const t = makeStatusTargets('en');
    applyHealthUi('offline', t);
    assert.equal(t.input.disabled, true);
    assert.equal(t.offlineMsg.hidden, false);

    applyHealthUi('online', t);
    assert.equal(t.input.disabled, false);
    assert.equal(t.sendBtn.disabled, false);
    assert.equal(t.offlineMsg.hidden, true);
    assert.equal(t.statusEl.textContent, '● ONLINE');
  });

  it('keeps SEND disabled while a message is sending even if online', () => {
    const t = makeStatusTargets();
    applyHealthUi('online', { ...t, sending: true });
    assert.equal(t.input.disabled, false);
    assert.equal(t.sendBtn.disabled, true);
  });
});

describe('agent room markup (status)', () => {
  const page = readFileSync(new URL('../src/pages/agents/[id].astro', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/lib/agent-chat-ui.ts', import.meta.url), 'utf8');
  const health = readFileSync(new URL('../src/lib/agent-health.ts', import.meta.url), 'utf8');

  it('does not hardcode ● ONLINE without status logic', () => {
    assert.equal(/class="chat-status">● ONLINE</.test(page), false);
    assert.match(page, /id="chat-status"/);
    assert.match(page, /data-state="connecting"/);
    assert.match(page, /id="chat-offline-msg"/);
  });

  it('wires health check into chat UI without innerHTML', () => {
    assert.equal(ui.includes('innerHTML'), false);
    assert.equal(health.includes('innerHTML'), false);
    assert.equal(ui.includes('checkAgentHealth'), true);
    assert.equal(ui.includes('applyHealthUi'), true);
  });
});
