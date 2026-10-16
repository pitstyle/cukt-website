# Habeas Mentem — print variant E3 (A4)

Self-contained rebuild of the two-page A4 layout served (draft, unlinked) at `/habeas-mentem/druk`.

Do **not** edit the statute text. Known source issues to keep as-is: no Art. 10 and Art. 16 (editorial note included), “przez Wiktoria”.

## What E3 is

A4 pages (794×1123 CSS px). Every page: top bar `CUKTAI // WIKTORIA CUKT 2.0` | `DOKUMENTACJA PROJEKTOWA · V 2.7 · 2026` + CUKTAI logo, header block, footer with page n/N.

Body: ustawa text (Notion “Pełna ustawa v 2.7”, fetched 16.10.2026, word for word, Polish soft hyphens already in `blocks-hy.json`), JetBrains Mono 700 6.8px, 3 columns, justified, flowing around a diagonal (−42°) HABEAS / MENTEM cut-out (Bebas Neue). Layout is baked to absolutely positioned `div`s — the site snapshot contains **no JS**.

JetBrains Mono and Bebas Neue are SIL Open Font License (Google Fonts).

## Rebuild (Node 20+)

Fonts for this tool live in `fonts/` (`JetBrainsMono[wght].ttf`, `BebasNeue-Regular.ttf`). If they are missing:

```sh
mkdir -p fonts
curl -L -o "fonts/JetBrainsMono[wght].ttf" "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
curl -L -o fonts/BebasNeue-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf"
```

Then:

```sh
cd tools/habeas-druk
npm i @chenglou/pretext esbuild playwright hyphen
npx playwright install chromium
node build.mjs && node render.mjs
```

Outputs in this folder:

- `build.html` — layout runtime (not committed)
- `habeas-mentem-ustawa-druk-E3.html` — static, no JS
- `habeas-mentem-ustawa-druk-E3-A4.pdf` — A4, margin 0, print background

Optional previews: `pdftoppm -r 110 -png habeas-mentem-ustawa-druk-E3-A4.pdf prev-ustawa`

`hyphen` is only needed if you re-hyphenate fresh Notion text (`hyphenateSync` from `hyphen/pl`, `{minWordLength:7}` on kind `"p"` blocks). `blocks-hy.json` is already hyphenated (U+00AD).

## Copy into the website

The live draft page does **not** run this tool at site-build time. It serves the already-laid-out HTML with fonts as files (not ~700KB of inline base64).

After a successful `node render.mjs`:

1. Copy `habeas-mentem-ustawa-druk-E3-A4.pdf` → `public/habeas-mentem/druk/`
2. From the static HTML: take the two `.page` trees (replace logo `data:` URIs with `/habeas-mentem/druk/cuktai-logo.png`) → `src/data/habeas-mentem-druk-e3.html`
3. If fonts changed, copy them to `public/fonts/JetBrainsMono-Variable.ttf` and `public/fonts/BebasNeue-Regular.ttf`

Do not link `/habeas-mentem/druk` from navigation or sitemap. Keep `noindex`. Draft only — do not merge/deploy without Piotr’s approval.
