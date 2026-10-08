export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const SESSION_STORAGE_PREFIX = 'cuktai-chat-session-';

export type AgentSession = {
  getId: () => string;
  setId: (id: string) => void;
};

/**
 * In-memory chat session. A new id is minted on construction (page load)
 * and again after SESSION_IDLE_MS with no activity. Old localStorage keys
 * are removed and never read.
 */
export function createAgentSession(
  agentId: string,
  now: () => number = () => Date.now(),
): AgentSession {
  try {
    localStorage.removeItem(SESSION_STORAGE_PREFIX + agentId);
  } catch {
    // ignore missing localStorage (tests, locked storage)
  }

  let id = crypto.randomUUID();
  let lastActivity = now();

  return {
    getId() {
      const t = now();
      if (t - lastActivity > SESSION_IDLE_MS) {
        id = crypto.randomUUID();
      }
      lastActivity = t;
      return id;
    },
    setId(next: string) {
      id = next;
      lastActivity = now();
    },
  };
}
