/**
 * Forbidden patterns for Habeas Mentem dziennik entries.
 *
 * KEEP IN SYNC with cuktai-3.0 `cuktai/habeas/dziennik_site.py`.
 * Site tests (`scripts/test-dziennik.ts`) and the generator's safety filter
 * must agree on what is blocked before a content-only PR is opened.
 */

export type ForbiddenPattern = { name: string; re: RegExp };

/** Queue / pipeline / slide-deck leakage from internal research tooling. */
export const TECHNICAL_PATTERNS: ForbiddenPattern[] = [
  { name: 'kolejka IG', re: /kolejka\s+IG/i },
  { name: 'Format:', re: /\bFormat:/ },
  { name: 'rura N', re: /\brura\s+\d+/i },
  { name: 'slajd', re: /\bslajd/i },
  { name: 'Stan:', re: /\bStan:/ },
  { name: 'DO PUBLIKACJI', re: /DO PUBLIKACJI/i },
  { name: 'STATUS', re: /\bSTATUS\b/ },
  { name: 'TODO', re: /\bTODO\b/ },
];

/** Absolute machine paths that must never ship in public entries. */
export const ABSOLUTE_PATH_PATTERNS: ForbiddenPattern[] = [
  { name: '~/', re: /~\// },
  { name: '/Users/', re: /\/Users\// },
  { name: '/home/', re: /\/home\// },
];

/**
 * Relative internal workspace paths (research tree, not public URLs).
 * Blocks publications/…, wiki/…, state/… and path-like *.md / *.json / *.py.
 */
export const RELATIVE_INTERNAL_PATH_PATTERNS: ForbiddenPattern[] = [
  { name: 'publications/', re: /\bpublications\//i },
  { name: 'wiki/', re: /\bwiki\//i },
  { name: 'state/', re: /\bstate\//i },
  {
    name: 'relative .md/.json/.py path',
    re: /(?:^|[\s("'`\[])(?:\.\/|\.\.\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:md|json|py)\b/,
  },
  {
    name: 'bare .md/.json/.py file',
    re: /(?:^|[\s("'`\[])[\w.-]+\.(?:md|json|py)\b/,
  },
];

/**
 * Secret-looking contexts only — ordinary prose with the word "token"
 * (e.g. legal / NLP discussion) must pass.
 */
export const SECRET_PATTERNS: ForbiddenPattern[] = [
  { name: 'sk-', re: /\bsk-[A-Za-z0-9]/ },
  { name: 'ghp_', re: /\bghp_[A-Za-z0-9]+/ },
  { name: 'xox', re: /\bxox[a-z]?-/i },
  { name: 'API_KEY=', re: /API_KEY\s*=/ },
  { name: 'token assignment', re: /\btoken\s*[:=]/i },
  { name: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/ },
];

export const INTERNAL_HOST_PATTERNS: ForbiddenPattern[] = [
  { name: '100.x tailscale', re: /\b100\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { name: '.ts.net', re: /\.ts\.net\b/i },
  { name: 'localhost', re: /\blocalhost\b/i },
];

export const MODEL_PATTERNS: ForbiddenPattern[] = [
  { name: 'GPT', re: /\bGPT\b/i },
  { name: 'Claude', re: /\bClaude\b/i },
  { name: 'Gemini', re: /\bGemini\b/i },
  { name: 'DeepSeek', re: /\bDeepSeek\b/i },
  { name: 'Llama', re: /\bLlama\b/i },
  { name: 'Qwen', re: /\bQwen\b/i },
  { name: 'Bielik', re: /\bBielik\b/i },
  { name: 'OpenAI', re: /\bOpenAI\b/i },
  { name: 'Anthropic', re: /\bAnthropic\b/i },
  { name: 'cheaperinference', re: /\bcheaperinference\b/i },
  { name: 'OpenRouter', re: /\bOpenRouter\b/i },
];

/** Flat list used by content safety scans. */
export const DZIENNIK_FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  ...TECHNICAL_PATTERNS,
  ...ABSOLUTE_PATH_PATTERNS,
  ...RELATIVE_INTERNAL_PATH_PATTERNS,
  ...SECRET_PATTERNS,
  ...INTERNAL_HOST_PATTERNS,
  ...MODEL_PATTERNS,
];

export function findDziennikForbidden(text: string): string[] {
  const found: string[] = [];
  for (const { name, re } of DZIENNIK_FORBIDDEN_PATTERNS) {
    if (re.test(text)) found.push(name);
  }
  return found;
}
