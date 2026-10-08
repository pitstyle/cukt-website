/**
 * Chat content must never be inserted as HTML.
 * Manual check: payload `<img src=x onerror=alert(1)>` must appear as literal text.
 */
export function setPlainText(target: { textContent: string | null }, text: string): void {
  target.textContent = text;
}

export function appendPlainText(target: { textContent: string | null }, chunk: string): void {
  target.textContent = (target.textContent ?? '') + chunk;
}
