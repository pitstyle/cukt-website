import { readSseStream, type SseEvent } from './sse-parser.ts';

export const CHAT_TIMEOUT_MS = 180_000;

export const MSG_TIMEOUT = 'Request timed out — try again.';
export const MSG_OFFLINE = '[System offline — try again later]';
export const MSG_CONNECTION = '[Connection failed — the bureau is temporarily unavailable]';
export const MSG_GENERIC = 'Something went wrong — try again.';
export const MSG_EMPTY = 'No response.';

export type SendChatOptions = {
  chatApi: string;
  agent: string;
  message: string;
  sessionId: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  onStatus?: (text: string) => void;
  onDelta?: (chunk: string) => void;
};

export type SendChatResult = {
  reply: string;
  sessionId?: string;
  audioUrl?: string;
  via: 'stream' | 'fallback';
};

export class ChatRequestError extends Error {
  readonly kind: 'timeout' | 'http' | 'network' | 'server';

  constructor(message: string, kind: ChatRequestError['kind'] = 'network') {
    super(message);
    this.name = 'ChatRequestError';
    this.kind = kind;
  }
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isAbortError(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
    return true;
  }
  return false;
}

function abortError(signal: AbortSignal): ChatRequestError {
  const reason = signal.reason;
  if (reason instanceof ChatRequestError) return reason;
  return new ChatRequestError(MSG_TIMEOUT, 'timeout');
}

async function fallbackChat(
  opts: SendChatOptions,
  fetchImpl: typeof fetch,
): Promise<SendChatResult> {
  const url = opts.chatApi.replace(/\/$/, '') + '/chat';
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: opts.agent,
        message: opts.message,
        session_id: opts.sessionId,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if (isAbortError(err, opts.signal)) throw abortError(opts.signal);
    throw new ChatRequestError(MSG_CONNECTION, 'network');
  }

  if (!res.ok) {
    throw new ChatRequestError(MSG_OFFLINE, 'http');
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ChatRequestError(MSG_OFFLINE, 'http');
  }

  const reply = asString(data.response) || asString(data.reply) || MSG_EMPTY;
  const audioUrl = asString(data.audio_url);
  return {
    reply,
    sessionId: asString(data.session_id),
    audioUrl,
    via: 'fallback',
  };
}

function handleStreamEvent(
  evt: SseEvent,
  acc: { text: string; done?: SendChatResult; error?: string },
  opts: SendChatOptions,
) {
  const payload = parseJson(evt.data) ?? {};
  if (evt.event === 'status') {
    const text = asString(payload.text);
    if (text) opts.onStatus?.(text);
    return;
  }
  if (evt.event === 'delta') {
    const chunk = asString(payload.text) ?? '';
    if (chunk) {
      acc.text += chunk;
      opts.onDelta?.(chunk);
    }
    return;
  }
  if (evt.event === 'done') {
    const reply = asString(payload.reply) ?? acc.text;
    acc.done = {
      reply,
      sessionId: asString(payload.session_id),
      via: 'stream',
    };
    return;
  }
  if (evt.event === 'error') {
    acc.error = asString(payload.message) || MSG_GENERIC;
  }
}

async function streamChat(
  opts: SendChatOptions,
  fetchImpl: typeof fetch,
): Promise<{ result?: SendChatResult; sawEvent: boolean; aborted: boolean }> {
  const url = opts.chatApi.replace(/\/$/, '') + '/chat/stream';
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        agent: opts.agent,
        message: opts.message,
        session_id: opts.sessionId,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if (isAbortError(err, opts.signal)) return { sawEvent: false, aborted: true };
    return { sawEvent: false, aborted: false };
  }

  if (res.status === 404 || res.status === 405) {
    return { sawEvent: false, aborted: false };
  }

  if (!res.ok || !res.body) {
    return { sawEvent: false, aborted: false };
  }

  const acc: { text: string; done?: SendChatResult; error?: string } = { text: '' };
  let sawEvent = false;

  try {
    await readSseStream(res.body, (evt) => {
      sawEvent = true;
      handleStreamEvent(evt, acc, opts);
    });
  } catch (err) {
    if (isAbortError(err, opts.signal)) {
      return { sawEvent, aborted: true };
    }
    if (!sawEvent) return { sawEvent: false, aborted: false };
    throw new ChatRequestError(MSG_CONNECTION, 'network');
  }

  if (acc.error) {
    throw new ChatRequestError(acc.error, 'server');
  }
  if (acc.done) return { result: acc.done, sawEvent, aborted: false };
  if (sawEvent && acc.text) {
    return { result: { reply: acc.text, via: 'stream' }, sawEvent, aborted: false };
  }
  return { result: undefined, sawEvent, aborted: false };
}

/**
 * POST /chat/stream (SSE). If the stream endpoint is missing (404/405) or
 * fails before any event arrives, fall back to POST /chat.
 */
export async function sendChat(opts: SendChatOptions): Promise<SendChatResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const streamed = await streamChat(opts, fetchImpl);
  if (streamed.aborted) throw abortError(opts.signal);
  if (streamed.result) return streamed.result;
  if (streamed.sawEvent) {
    throw new ChatRequestError(MSG_CONNECTION, 'network');
  }
  return fallbackChat(opts, fetchImpl);
}

export function withTimeout(timeoutMs: number = CHAT_TIMEOUT_MS): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new ChatRequestError(MSG_TIMEOUT, 'timeout'));
  }, timeoutMs);
  return {
    controller,
    dispose() {
      clearTimeout(timer);
    },
  };
}
