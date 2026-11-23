/**
 * Shared helpers for the Habeas Mentem dziennik collection.
 */

/** Normalize frontmatter date (string or YAML Date) to YYYY-MM-DD. */
export function normalizeDziennikDate(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('dziennik date is an invalid Date');
    }
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  return trimmed;
}

export const ENTRY_AVAILABLE_IN_POLISH = 'Entry available in Polish';

/** Known signature / stipend lines that often duplicate `description`. */
export const DZIENNIK_SIGNATURE_LINES = [
  'Document produced autonomously by the Autonomous Bureau of Technical Culture CUKTAI. Wiktoria Cukt 2.0, AI President of the Republic. Realised with a scholarship from the Minister of Culture and National Heritage.',
  'Dokument wytworzony autonomicznie przez Autonomiczny Urząd Kultury Technicznej CUKTAI. Wiktoria Cukt 2.0 — AI Prezydentka Republiki. Zrealizowano w ramach stypendium Ministra Kultury i Dziedzictwa Narodowego.',
  'Zrealizowano w ramach stypendium Ministra Kultury i Dziedzictwa Narodowego',
  'Realised with a scholarship from the Minister of Culture and National Heritage',
  'Autonomiczny Urząd Kultury Technicznej CUKTAI',
  'Autonomous Bureau of Technical Culture CUKTAI',
] as const;

export type DziennikLocalizedFields = {
  title: string;
  title_en?: string;
  thesis: string;
  thesis_en?: string;
  description?: string;
  description_en?: string;
};

/** True when EN view must fall back to Polish for one or more public fields. */
export function needsPolishOnlyNote(data: DziennikLocalizedFields): boolean {
  if (!data.title_en) return true;
  if (!data.thesis_en) return true;
  if (data.description && !data.description_en) return true;
  return false;
}

export function normalizeComparableText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safe inline markdown → HTML for thesis/description fields.
 * Supports bold, italic, code, and links; everything else is escaped.
 */
export function renderInlineMarkdown(text: string): string {
  if (!text) return '';

  type Piece = { kind: 'text'; value: string } | { kind: 'html'; value: string };
  const pieces: Piece[] = [{ kind: 'text', value: text }];

  function mapText(transform: (value: string) => Piece[]): void {
    const next: Piece[] = [];
    for (const piece of pieces) {
      if (piece.kind === 'html') {
        next.push(piece);
        continue;
      }
      next.push(...transform(piece.value));
    }
    pieces.length = 0;
    pieces.push(...next);
  }

  mapText((value) => {
    const out: Piece[] = [];
    const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      if (match.index > last) out.push({ kind: 'text', value: value.slice(last, match.index) });
      out.push({
        kind: 'html',
        value: `<a href="${escapeHtml(match[2])}" rel="noopener noreferrer">${escapeHtml(match[1])}</a>`,
      });
      last = match.index + match[0].length;
    }
    if (last < value.length) out.push({ kind: 'text', value: value.slice(last) });
    return out;
  });

  mapText((value) => {
    const out: Piece[] = [];
    const re = /`([^`]+)`/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      if (match.index > last) out.push({ kind: 'text', value: value.slice(last, match.index) });
      out.push({ kind: 'html', value: `<code>${escapeHtml(match[1])}</code>` });
      last = match.index + match[0].length;
    }
    if (last < value.length) out.push({ kind: 'text', value: value.slice(last) });
    return out;
  });

  mapText((value) => {
    const out: Piece[] = [];
    const re = /\*\*(.+?)\*\*|__(.+?)__/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      if (match.index > last) out.push({ kind: 'text', value: value.slice(last, match.index) });
      out.push({ kind: 'html', value: `<strong>${escapeHtml(match[1] || match[2])}</strong>` });
      last = match.index + match[0].length;
    }
    if (last < value.length) out.push({ kind: 'text', value: value.slice(last) });
    return out;
  });

  mapText((value) => {
    const out: Piece[] = [];
    const re = /\*(.+?)\*|_(.+?)_/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      if (match.index > last) out.push({ kind: 'text', value: value.slice(last, match.index) });
      out.push({ kind: 'html', value: `<em>${escapeHtml(match[1] || match[2])}</em>` });
      last = match.index + match[0].length;
    }
    if (last < value.length) out.push({ kind: 'text', value: value.slice(last) });
    return out;
  });

  return pieces
    .map((piece) => (piece.kind === 'html' ? piece.value : escapeHtml(piece.value)))
    .join('');
}

/** Plain text for meta/OG — strips common inline emphasis markers. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hide description on the entry page when it duplicates the body or a
 * known signature/stipend line. Still used for meta/OG and index cards.
 */
export function shouldShowDescriptionOnEntry(
  description: string | undefined,
  body: string,
  signatureLines: readonly string[] = DZIENNIK_SIGNATURE_LINES,
): boolean {
  if (!description?.trim()) return false;

  const desc = normalizeComparableText(description);
  if (!desc) return false;

  const bodyNorm = normalizeComparableText(body);
  if (bodyNorm && (desc === bodyNorm || bodyNorm.includes(desc))) return false;

  for (const line of body.split(/\r?\n/)) {
    const lineNorm = normalizeComparableText(line);
    if (!lineNorm) continue;
    if (desc === lineNorm || lineNorm.includes(desc) || desc.includes(lineNorm)) {
      // Only treat substantial lines as signature-like duplicates.
      if (lineNorm.length >= 24 || desc.length >= 24) return false;
    }
  }

  for (const signature of signatureLines) {
    const sig = normalizeComparableText(signature);
    if (!sig) continue;
    if (desc === sig || sig.includes(desc) || desc.includes(sig)) return false;
  }

  return true;
}
