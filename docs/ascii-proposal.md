# ASCII Aesthetic Proposal — cukt.click

**Status:** Mockup / proposal only. Do not merge.  
**Date:** 8 October 2026  
**Package tried:** `ascii.rest@0.2.1` (pinned exact)

---

## License verdict

**License name (quoted from the repo `LICENSE` file):** `MIT License`

Copyright line: `Copyright (c) 2026 bas3line (https://github.com/bas3line)`

Required notice, quoted:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

**Where the attribution goes if we ship the library**

- Keep the MIT header in any copied source (already in `src/components/mockups/AsciiPiece.astro`).
- Add a short `NOTICE` file at the repo root, or a “Third-party” paragraph in the existing about/credits copy, with: `ascii.rest © 2026 bas3line, MIT License`.
- Do not put it only in a chat message. The notice has to travel with the Software.

ascii.rest is safe to use under MIT. It is not an image-to-ASCII converter.

---

## What ascii.rest actually is

It is a **client-side TypeScript library of 215 pre-authored animated pieces** (donut, big-text, scramble, night-coast, and so on). It is not a server API for converting photographs.

- **npm:** `ascii.rest@0.2.1` — works in Astro.
- **ascii.rest the website** can also load a script from `https://ascii.rest/ascii.js` and a 3 KB font from `https://ascii.rest/fonts/…`. That path is an external runtime dependency. We did **not** use it.
- **No image input.** There is no “give me this JPG as ASCII” piece. Wiktoria’s portrait therefore uses a **small local canvas → `<pre>` renderer** in the mockup.

---

## Recommended approach

1. **Do not** load `https://ascii.rest/ascii.js` at runtime.
2. **Do not** use `ascii.rest/astro` as-is for production. That helper imports the full piece catalog; this build then emitted **215 extra JS chunks (~808 KB uncompressed)** into `dist/_astro/` even when the page only needed two pieces.
3. **Do** pin `ascii.rest@0.2.1` (or whatever version Piotr accepts) and **import only the pieces we use**, as the mockup does (`big-text`, `scramble`) via `src/components/mockups/AsciiPiece.astro`.
4. **For portraits:** keep the local image-to-ASCII renderer (or pre-render ASCII at build time). ascii.rest cannot do this.
5. Hold first frame when `prefers-reduced-motion: reduce` is set. ascii.rest’s `mount()` already does this; the portrait renderer does too.

---

## Measured bundle size (this build)

From `npm run build` output on this branch, files actually referenced by the mockup pages:

| File | Raw | gzip |
| --- | ---: | ---: |
| `dist/_astro/AsciiPiece.astro_astro_type_script_index_0_lang.DlWIegUS.js` (mount + `big-text` + `scramble`) | **7,717 bytes** | **3,797 bytes** |
| Inline portrait renderer on `/mockups/ascii-agent-room` | ~1.6 KB in the HTML | — |
| Wiktoria portrait JPG (already on the site) | 13 KB | — |

Contrast, if we had used `import Ascii from "ascii.rest/astro"`:

- Runtime JS still ~18 KB gzip ~7 KB, then lazy-loads one piece at a time.
- **Vite still wrote every piece into `dist/` (~808 KB, 208 JS files).** Those files would go live on Render even if the browser never requested them.

Mobile Safari cost of the recommended path: about **4 KB gzip of JS** plus the existing JetBrains Mono font the mockup already loads from Google Fonts. No ascii.rest font request.

---

## Content sources (nothing invented)

Removed the fake stats row (`Sessions 1,247`, `Uptime 99.2%`). Those numbers are not on the live agent rooms.

| Mockup text | Source |
| --- | --- |
| Wiktoria name, role, description, quote, greeting, chat chrome | `src/pages/agents/[id].astro` (`wiktoria`) |
| Portrait file | `/uploads/4/6/4/1/4641121/published/wiktoria-2-0-01a-s.jpg` (also `src/content/cukt/wiktoria-cukt.md`) |
| `TECHNOPERA 2026` title | `src/pages/technopera.astro` (`<h1 class="hero-title">`) |
| `AUTHORITY. KNOWLEDGE. SEAL.` | `src/pages/technopera.astro` (`.triad-primary`) |
| `Premiered 4.10.2026 · MEDIATEKA, Tychy · Available for touring` | `src/pages/technopera.astro` hero meta when `TECHNOPERA_POST_PREMIERE` is true (`src/data/technopera.ts`) |
| `MEDIATEKA · Tychy · 4.10.2026` | same file, `imageAlt` / page title `Technopera 2026 · Mediateka Tychy · 4.10` |
| Technopera body sentence | `src/content/personal/technopera.md` |
| Habeas Mentem card | `src/pages/habeas-mentem.astro` |
| Wiktoriomat card | `src/content/personal/wiktoriomat.md` |

---

## Package maturity risk

`ascii.rest` is **0.2.1**. First published recently. One maintainer (`@bas3line`). The public API, piece list, and Astro entry can still change without a 1.x contract. Pin the exact version. Re-test after any bump. Have a fallback (our own `<pre>` frames) if the package stalls.

The Astro helper also injects `@font-face` pointing at `https://ascii.rest/fonts/ascii-rest-mono.woff2`. That is a third-party host. The mockup avoids it by using JetBrains Mono, which the site already uses.

---

## What a rollout would take (honest, includes a real iPhone)

This cloud environment cannot tap a physical iPhone. Any estimate that skips that is incomplete. Safari on iOS is where monospace metrics, 100vh, and `clamp()` font sizes on 66-column ASCII actually break.

**All agent rooms** (7 rooms, shared `[id].astro` template, portraits where a real image exists, chat kept as-is):

- Agent work: **about 1 day** (layout, per-agent images, reduced-motion, contrast, noindex-off for production, wire `AsciiPiece` or equivalent).
- Real iPhone pass (Safari, 375 and 390, VoiceOver, reduced motion, slow 4G): **2–3 hours**, on a physical phone, not Chrome device mode.
- Piotr review: **1–2 hours**.

**All project cards** (home/archive/personal listings):

- Agent work: **about half a day to 1 day**.
- Real iPhone pass on listing + inner pages: **2 hours**.
- Piotr review: **1 hour**.

**Both:** about **2 days of agent work**, plus **half a day of real-device testing**, plus **2–3 hours of review**. Not “3–4 hours.” The first mockup’s shorter number ignored iPhone Safari.

---

## Risks

- **Performance:** portrait ASCII rewritten every animation frame is cheap at ~40×36 cells. Do not animate every card on a long listing. Prefer CSS scanline or static `<pre>`.
- **Accessibility:** ASCII is `aria-hidden`; the real `alt` lives on the hidden `<img>`. Body text is 16px. Tap targets are ≥44px.
- **Maintenance:** 0.x library; piece catalog import bloats `dist/` unless we import named pieces.
- **Look vs the rest of the site:** agent rooms are already brutalist/mono. ASCII portraits are a bigger jump than box-drawing frames. That is the open question.
- **Horizontal scroll:** 66-column `big-text` only fits at ~8px on a 390px phone. Readable as ornament, not as body type.

---

## Open questions for Piotr

1. Full ASCII portraits, ornaments only, or a still photo inside an ASCII frame?
2. Agent rooms first, or project cards too?
3. Is 8px block-letter `TECHNOPERA` on iPhone enough, or should the banner wrap / shorten (`Cukt`, `2026`)?
4. May we add a one-line MIT credit for ascii.rest, and where?
5. Accept the 0.x / single-maintainer risk, or keep only our own renderer?

---

## Mockup routes

- `/mockups/ascii-agent-room` — noindex, not in nav, not in sitemap
- `/mockups/ascii-project-card` — same

Both are draft-only. Merging this branch to `main` would still publish the mockup URLs on cukt.click (Render auto-deploy). Keep the PR draft until Piotr says otherwise.
