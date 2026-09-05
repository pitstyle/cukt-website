export const CHAT_API =
  import.meta.env.PUBLIC_CHAT_API || "https://wiktorias-mac-mini.tail6d1aae.ts.net";

export function chatSessionId(agent: string): string {
  const key = `cuktai-chat-session-${agent}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
