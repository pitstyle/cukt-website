export type SseEvent = {
  event: string;
  data: string;
  id?: string;
};

const DEFAULT_EVENT = 'message';

/** Parse one SSE event block (fields separated by newlines, no trailing blank line). */
export function parseSseBlock(block: string): SseEvent | null {
  let event = DEFAULT_EVENT;
  const dataLines: string[] = [];
  let id: string | undefined;

  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '' || line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
    else if (field === 'id') id = value;
  }

  if (dataLines.length === 0) return null;
  const parsed: SseEvent = { event, data: dataLines.join('\n') };
  if (id !== undefined) parsed.id = id;
  return parsed;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Incremental SSE parser.
 * Events are delimited by a blank line. Incomplete lines stay buffered
 * until the next chunk (or flush). Comment lines starting with `:` are ignored.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = '';

  function dispatch(block: string) {
    const parsed = parseSseBlock(block);
    if (parsed) onEvent(parsed);
  }

  function drain(flush: boolean) {
    buffer = normalizeNewlines(buffer);
    let idx = buffer.indexOf('\n\n');
    while (idx !== -1) {
      dispatch(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf('\n\n');
    }
    if (flush && buffer.length > 0) {
      dispatch(buffer);
      buffer = '';
    }
  }

  return {
    feed(chunk: string) {
      buffer += chunk;
      drain(false);
    },
    flush() {
      drain(true);
    },
  };
}

export async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(onEvent);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.flush();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}
