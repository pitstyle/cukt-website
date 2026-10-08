/**
 * Layout check for /agents pages: the ASCII room, input, and SEND
 * must sit inside the card at 320, 390, and 1280 px.
 */
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { mkdir } from "node:fs/promises";

const ORIGIN = process.env.FIT_ORIGIN || "http://127.0.0.1:4173";
const OUT = "/opt/cursor/artifacts/screenshots";
const WIDTHS = [320, 390, 1280];
const PAGES = [
  { path: "/agents/wiktoria/", prefix: "agent-wiktoria" },
  { path: "/agents/peter/", prefix: "agent-peter" },
];
const SLOP = 1;

function round(n) {
  return Math.round(n * 100) / 100;
}

async function measure(page) {
  return page.evaluate((slop) => {
    const stack = document.querySelector(".ascii-agent-stack");
    if (!stack) return { error: "missing .ascii-agent-stack" };
    const card = stack.getBoundingClientRect();
    const names = {
      input: "#chat-text",
      send: "#chat-send",
      pre: "pre.ascii-room",
    };
    const rows = [];
    for (const [name, sel] of Object.entries(names)) {
      const el = document.querySelector(sel);
      if (!el) {
        rows.push({ name, ok: false, error: "missing" });
        continue;
      }
      const r = el.getBoundingClientRect();
      const dxL = card.left - r.left;
      const dxR = r.right - card.right;
      const dyT = card.top - r.top;
      const dyB = r.bottom - card.bottom;
      const ok = dxL <= slop && dxR <= slop && dyT <= slop && dyB <= slop;
      rows.push({
        name,
        ok,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        overflowLeft: Math.max(0, dxL),
        overflowRight: Math.max(0, dxR),
        overflowTop: Math.max(0, dyT),
        overflowBottom: Math.max(0, dyB),
      });
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom, width: card.width },
      rows,
    };
  }, SLOP);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
  ],
});

await mkdir(OUT, { recursive: true });
const page = await browser.newPage();
let failed = 0;

for (const { path, prefix } of PAGES) {
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: width === 390 ? 2 : 1 });
    await page.goto(ORIGIN + path, { waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await new Promise((r) => setTimeout(r, 300));

    const m = await measure(page);
    const scrollOk = m.scrollWidth === m.clientWidth;
    const allIn = m.rows?.every((row) => row.ok);
    if (!scrollOk || !allIn) failed += 1;

    console.log(`\n${path} @ ${width}px`);
    console.log(
      `  card  left=${round(m.card?.left)} right=${round(m.card?.right)} width=${round(m.card?.width)}`,
    );
    console.log(
      `  scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} equal=${scrollOk}`,
    );
    for (const row of m.rows || []) {
      console.log(
        `  ${row.name.padEnd(6)} left=${round(row.left)} right=${round(row.right)}` +
          `  overflow L/R/T/B=${round(row.overflowLeft)}/${round(row.overflowRight)}/${round(row.overflowTop)}/${round(row.overflowBottom)}` +
          `  within=${row.ok}`,
      );
    }

    if (width === 390) {
      const stack = await page.$(".ascii-agent-stack");
      if (stack) {
        await stack.screenshot({
          path: `${OUT}/${prefix}-stack.png`,
          type: "png",
          captureBeyondViewport: true,
        });
      }
    }
  }
}

await browser.close();
if (failed) {
  console.error(`\nFAIL: ${failed} viewport/page checks leaked outside the card`);
  process.exit(1);
}
console.log("\nOK: all checked elements sit inside the card; no horizontal scroll");
