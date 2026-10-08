import { createAgentSession } from './agent-session.ts';
import {
  ChatRequestError,
  MSG_CONNECTION,
  sendChat,
  withTimeout,
} from './agent-chat.ts';
import { appendPlainText, setPlainText } from './plain-text.ts';

const GREETINGS: Record<string, string> = {
  peter: 'System online. What do you want to know about C.U.K.T.?',
  ewa: 'Ewa here. Ask me something real — not theory.',
  mikolaj: 'Mikołaj... cicho. I\'m listening.',
  wiktoria: 'Wiktoria Cukt 2.0, protokół. State your business.',
  archiwistka: 'Archiwistka here. I have the files. What are you looking for? Over.',
  coder: 'Coder. Mini runtime. What broke?',
  researcher: 'Researcher. Send a lead or ask for open calls.',
};

function applyLanguage() {
  const lang = localStorage.getItem('cuktai-lang') || 'en';
  document.querySelectorAll('[data-pl][data-en]').forEach((el) => {
    const v = el.getAttribute(`data-${lang}`);
    if (v) el.textContent = v;
  });
  if (lang === 'pl') {
    const inp = document.querySelector('[data-pl-placeholder]');
    if (inp) inp.setAttribute('placeholder', inp.getAttribute('data-pl-placeholder') || '');
  }
}

function addMessage(
  messages: HTMLElement,
  name: string,
  text: string,
  isUser: boolean,
): { div: HTMLDivElement; body: HTMLSpanElement } {
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user-msg' : 'agent-msg'}`;

  const nameEl = document.createElement('span');
  nameEl.className = 'msg-name';
  setPlainText(nameEl, name);

  const body = document.createElement('span');
  body.className = 'msg-text';
  setPlainText(body, text);

  div.appendChild(nameEl);
  div.appendChild(body);
  messages.appendChild(div);
  messages.scrollTo(0, messages.scrollHeight);
  return { div, body };
}

function createPendingBubble(
  messages: HTMLElement,
  agentLabel: string,
): { div: HTMLDivElement; status: HTMLSpanElement; body: HTMLSpanElement } {
  const div = document.createElement('div');
  div.className = 'msg agent-msg';

  const nameEl = document.createElement('span');
  nameEl.className = 'msg-name';
  setPlainText(nameEl, agentLabel);

  const status = document.createElement('span');
  status.className = 'msg-status is-visible';
  setPlainText(status, 'thinking...');

  const body = document.createElement('span');
  body.className = 'msg-text';

  div.appendChild(nameEl);
  div.appendChild(status);
  div.appendChild(body);
  messages.appendChild(div);
  messages.scrollTo(0, messages.scrollHeight);
  return { div, status, body };
}

function attachAudioButton(body: HTMLElement, audioUrl: string) {
  const btn = document.createElement('button');
  setPlainText(btn, ' ▶ PLAY');
  btn.style.cssText =
    'background:none;border:1px solid var(--green,#0f0);color:var(--green,#0f0);font-family:monospace;font-size:0.7rem;padding:2px 8px;margin-left:8px;cursor:pointer;letter-spacing:0.1em;';
  btn.onclick = () => {
    const a = new Audio(audioUrl);
    a.play();
    setPlainText(btn, ' ■ PLAYING');
    a.onended = () => {
      setPlainText(btn, ' ▶ REPLAY');
    };
  };
  body.appendChild(btn);
  try {
    new Audio(audioUrl).play().catch(() => {});
  } catch {
    // autoplay blocked
  }
}

export function initAgentPageChat(root: ParentNode = document) {
  const container = root.querySelector<HTMLElement>('[data-agent-chat]');
  if (!container) return;

  const agentId = container.dataset.agentId || '';
  const agentName = container.dataset.agentName || '';
  const agentEmoji = container.dataset.agentEmoji || '';
  const chatApi = (container.dataset.chatApi || '').replace(/\/$/, '');
  const agentLabel = `${agentEmoji} ${agentName}`.trim();

  const messages = root.querySelector<HTMLElement>('#chat-messages');
  const form = root.querySelector<HTMLFormElement>('#chat-form');
  const input = root.querySelector<HTMLInputElement>('#chat-text');
  const sendBtn = root.querySelector<HTMLButtonElement>('#chat-send');
  const greeting = root.querySelector<HTMLElement>('#greeting');

  applyLanguage();
  if (greeting) setPlainText(greeting, GREETINGS[agentId] || 'Ready.');

  const session = createAgentSession(agentId);
  let sending = false;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || !input?.value?.trim() || !messages) return;

    const text = input.value.trim();
    input.value = '';
    addMessage(messages, '👤 YOU', text, true);

    sending = true;
    if (sendBtn) sendBtn.disabled = true;

    const pending = createPendingBubble(messages, agentLabel);
    let serverStatus = false;
    const { controller, dispose } = withTimeout();

    try {
      const result = await sendChat({
        chatApi,
        agent: agentId,
        message: text,
        sessionId: session.getId(),
        signal: controller.signal,
        onStatus(statusText) {
          serverStatus = true;
          setPlainText(pending.status, statusText);
          pending.status.classList.add('is-visible');
          messages.scrollTo(0, messages.scrollHeight);
        },
        onDelta(chunk) {
          if (!serverStatus) pending.status.classList.remove('is-visible');
          appendPlainText(pending.body, chunk);
          messages.scrollTo(0, messages.scrollHeight);
        },
      });

      if (result.sessionId) session.setId(result.sessionId);
      pending.status.classList.remove('is-visible');
      setPlainText(pending.body, result.reply);

      if (result.audioUrl) {
        const audioUrl = result.audioUrl.startsWith('http')
          ? result.audioUrl
          : chatApi + result.audioUrl;
        attachAudioButton(pending.body, audioUrl);
      }
    } catch (err) {
      pending.status.classList.remove('is-visible');
      const message =
        err instanceof ChatRequestError
          ? err.message
          : MSG_CONNECTION;
      setPlainText(pending.body, message);
    } finally {
      dispose();
      sending = false;
      if (sendBtn) sendBtn.disabled = false;
      input?.focus();
      messages.scrollTo(0, messages.scrollHeight);
    }
  });
}
