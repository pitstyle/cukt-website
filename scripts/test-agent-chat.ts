import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ChatRequestError,
  MSG_CONNECTION,
  MSG_EMPTY,
  MSG_GENERIC,
  MSG_OFFLINE,
  sendChat,
} from '../src/lib/agent-chat.ts';
import { SESSION_IDLE_MS, SESSION_STORAGE_PREFIX, createAgentSession } from '../src/lib/agent-session.ts';
import { appendPlainText, setPlainText } from '../src/lib/plain-text.ts';
import { createSseParser, parseSseBlock } from '../src/lib/sse-parser.ts';

function collectedParser() {
  const events: { event: string; data: string; id?: string }[] = [];
  const parser = createSseParser((evt) => events.push(evt));
  return { events, parser };
}

describe('sse parser', () => {
  it('parses a complete event', () => {
    const { events, parser } = collectedParser();
    parser.feed('event: status\ndata: {"text": "szukam w archiwum…"}\n\n');
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'status');
    assert.equal(events[0].data, '{"text": "szukam w archiwum…"}');
  });

  it('joins multiple data lines and ignores keep-alive comments', () => {
    const { events, parser } = collectedParser();
    parser.feed(': keep-alive\n\n');
    parser.feed('event: delta\ndata: hello\ndata: world\n\n');
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'delta');
    assert.equal(events[0].data, 'hello\nworld');
  });

  it('handles chunks split mid-line and mid-event', () => {
    const { events, parser } = collectedParser();
    parser.feed('event: del');
    parser.feed('ta\ndata: {"text": "he');
    parser.feed('llo"}\n');
    parser.feed('\nevent: done\ndata: {"reply": "hello", "session_id": "abc"}\n\n');
    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'delta');
    assert.equal(events[0].data, '{"text": "hello"}');
    assert.equal(events[1].event, 'done');
  });

  it('parses CRLF events and strips one leading space after the colon', () => {
    const { events, parser } = collectedParser();
    parser.feed('event: error\r\ndata: {"message": "nope"}\r\n\r\n');
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'error');
    assert.equal(events[0].data, '{"message": "nope"}');
  });

  it('flush emits a trailing event without a blank line', () => {
    const { events, parser } = collectedParser();
    parser.feed('event: done\ndata: {"reply": "ok"}');
    assert.equal(events.length, 0);
    parser.flush();
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'done');
  });

  it('parseSseBlock returns null for comments-only blocks', () => {
    assert.equal(parseSseBlock(': ping\n: still ping'), null);
  });
});

describe('plain text rendering (XSS)', () => {
  const payload = '<img src=x onerror=alert(1)>';

  it('stores the XSS payload as literal text, never HTML', () => {
    const el = { textContent: '' as string | null };
    setPlainText(el, payload);
    assert.equal(el.textContent, payload);
    appendPlainText(el, '\n' + payload);
    assert.equal(el.textContent, payload + '\n' + payload);
  });

  it('agent chat UI does not use innerHTML', () => {
    const ui = readFileSync(new URL('../src/lib/agent-chat-ui.ts', import.meta.url), 'utf8');
    const page = readFileSync(new URL('../src/pages/agents/[id].astro', import.meta.url), 'utf8');
    assert.equal(ui.includes('innerHTML'), false);
    assert.equal(page.includes('innerHTML'), false);
    assert.equal(ui.includes('setPlainText'), true);
  });
});

describe('agent session', () => {
  it('mints a fresh id and removes the old localStorage key', () => {
    const removed: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        removeItem(key: string) {
          removed.push(key);
        },
        getItem() {
          return 'stale-session';
        },
        setItem() {
          throw new Error('session id must not be written to localStorage');
        },
      },
    });

    let t = 1_000;
    const session = createAgentSession('peter', () => t);
    const first = session.getId();
    assert.notEqual(first, 'stale-session');
    assert.equal(removed.includes(SESSION_STORAGE_PREFIX + 'peter'), true);

    t += SESSION_IDLE_MS;
    assert.equal(session.getId(), first, 'activity inside the idle window keeps the id');

    t += SESSION_IDLE_MS + 1;
    const rotated = session.getId();
    assert.notEqual(rotated, first);
  });
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(chunks: string[], status = 200, hang = false) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      if (!hang) controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function chatOpts(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof sendChat>[0]> = {}) {
  return {
    chatApi: 'https://chat.example',
    agent: 'peter',
    message: 'hello',
    sessionId: 'sess-1',
    signal: extra.signal ?? new AbortController().signal,
    fetchImpl,
    ...extra,
  };
}

describe('sendChat stream + fallback', () => {
  it('streams status, deltas, and done', async () => {
    const statuses: string[] = [];
    const deltas: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      assert.equal(url.endsWith('/chat/stream'), true);
      return sseResponse([
        'event: status\ndata: {"text":"szukam w archiwum…"}\n\n',
        'event: delta\ndata: {"text":"The "}\n\n',
        'event: delta\ndata: {"text":"archive"}\n\n',
        'event: done\ndata: {"reply":"The archive","session_id":"s2"}\n\n',
      ]);
    };

    const result = await sendChat(
      chatOpts(fetchImpl, {
        onStatus: (t) => statuses.push(t),
        onDelta: (t) => deltas.push(t),
      }),
    );
    assert.deepEqual(statuses, ['szukam w archiwum…']);
    assert.deepEqual(deltas, ['The ', 'archive']);
    assert.equal(result.via, 'stream');
    assert.equal(result.reply, 'The archive');
    assert.equal(result.sessionId, 's2');
  });

  it('falls back to /chat on 404 before any event', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/chat/stream')) return new Response('', { status: 404 });
      if (url.endsWith('/chat')) {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.agent, 'peter');
        assert.equal(body.message, 'hello');
        assert.equal(body.session_id, 'sess-1');
        return jsonResponse(200, { response: 'fallback reply' });
      }
      throw new Error(url);
    };
    const result = await sendChat(chatOpts(fetchImpl));
    assert.equal(result.via, 'fallback');
    assert.equal(result.reply, 'fallback reply');
    assert.deepEqual(
      urls.map((u) => u.replace('https://chat.example/', '')),
      ['chat/stream', 'chat'],
    );
  });

  it('falls back to /chat on 405 before any event', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat/stream')) return new Response('', { status: 405 });
      return jsonResponse(200, { response: 'ok-405' });
    };
    const result = await sendChat(chatOpts(fetchImpl));
    assert.equal(result.via, 'fallback');
    assert.equal(result.reply, 'ok-405');
  });

  it('falls back when the stream fetch fails before any event', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat/stream')) throw new TypeError('network');
      return jsonResponse(200, { response: 'from-fallback' });
    };
    const result = await sendChat(chatOpts(fetchImpl));
    assert.equal(result.via, 'fallback');
    assert.equal(result.reply, 'from-fallback');
  });

  it('does not fall back after an event has arrived', async () => {
    let chatCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat/stream')) {
        return sseResponse(['event: status\ndata: {"text":"szukam…"}\n\n']);
      }
      chatCalls += 1;
      return jsonResponse(200, { response: 'should-not-run' });
    };
    await assert.rejects(
      () => sendChat(chatOpts(fetchImpl)),
      (err: unknown) => err instanceof ChatRequestError && err.message === MSG_CONNECTION,
    );
    assert.equal(chatCalls, 0);
  });

  it('surfaces a server error event without falling back', async () => {
    let chatCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat')) {
        chatCalls += 1;
        return jsonResponse(200, { response: 'nope' });
      }
      return sseResponse(['event: error\ndata: {"message":"archive down"}\n\n']);
    };
    await assert.rejects(
      () => sendChat(chatOpts(fetchImpl)),
      (err: unknown) => err instanceof ChatRequestError && err.message === 'archive down',
    );
    assert.equal(chatCalls, 0);
  });

  it('uses a generic error when the error event has no message', async () => {
    const fetchImpl: typeof fetch = async () =>
      sseResponse(['event: error\ndata: {}\n\n']);
    await assert.rejects(
      () => sendChat(chatOpts(fetchImpl)),
      (err: unknown) => err instanceof ChatRequestError && err.message === MSG_GENERIC,
    );
  });

  it('maps a failed fallback to the offline message', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat/stream')) return new Response('', { status: 404 });
      return new Response('', { status: 503 });
    };
    await assert.rejects(
      () => sendChat(chatOpts(fetchImpl)),
      (err: unknown) => err instanceof ChatRequestError && err.message === MSG_OFFLINE,
    );
  });

  it('uses done.reply even when it differs from streamed deltas', async () => {
    const fetchImpl: typeof fetch = async () =>
      sseResponse([
        'event: delta\ndata: {"text":"partial"}\n\n',
        'event: done\ndata: {"reply":"final text"}\n\n',
      ]);
    const result = await sendChat(chatOpts(fetchImpl));
    assert.equal(result.reply, 'final text');
  });

  it('does not treat a JSON empty reply as missing', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/chat/stream')) return new Response('', { status: 404 });
      return jsonResponse(200, { response: '' });
    };
    const result = await sendChat(chatOpts(fetchImpl));
    assert.equal(result.reply, MSG_EMPTY);
  });
});
