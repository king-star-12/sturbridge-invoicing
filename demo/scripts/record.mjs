/**
 * Records a demo film as one continuous browser session.
 *
 * This is a TEMPLATE. The helpers above the line are reusable; the beat list at
 * the bottom is what you edit per project.
 *
 *   node record.mjs http://localhost:3000 session.webm
 *
 * Reads  timings.json  (how long each beat holds — written by narrate.py)
 * Writes beats.json    (when each beat actually began — needed by mux.py)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const ROOT = process.env.DEMO_DIR ?? process.cwd();
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? path.join(ROOT, "session.webm");
const W = Number(process.env.VIEW_W ?? 1920);
const H = Number(process.env.VIEW_H ?? 1080);
const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/homebrew/bin/ffmpeg";

const timings = JSON.parse(fs.readFileSync(path.join(ROOT, "timings.json"), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome for Testing — the headless *shell* build cannot screencast. */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(os.homedir(), ".cache", "puppeteer", "chrome");
  if (fs.existsSync(cache)) {
    for (const version of fs.readdirSync(cache)) {
      const guess = path.join(cache, version, `chrome-${process.platform === "darwin" ? "mac" : "linux"}-${process.arch === "arm64" ? "arm64" : "x64"}`);
      const mac = path.join(guess, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (fs.existsSync(mac)) return mac;
      const linux = path.join(guess, "chrome");
      if (fs.existsSync(linux)) return linux;
    }
  }
  const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(system)) return system;
  throw new Error("No Chrome found — set CHROME_PATH");
}

/* ------------------------------------------------------------------ */
/* Injected page helpers                                               */
/* ------------------------------------------------------------------ */

/** Headless Chrome renders no cursor, so draw one the viewer can follow. */
const CURSOR = `
(() => {
  if (window.__cursor) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;width:22px;height:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))';
  el.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 2l14 8.4-6.1 1.2 3.2 6.6-2.7 1.3-3.2-6.6-4 3.6z" fill="#111" stroke="#fff" stroke-width="1.3"/></svg>';
  document.body.appendChild(el);
  let x = innerWidth * .5, y = innerHeight * .62;
  const put = () => el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  put();
  window.__cursor = {
    async glide(nx, ny, ms) {
      const sx = x, sy = y, t0 = performance.now();
      return new Promise((done) => {
        const step = (t) => {
          const p = Math.min(1, (t - t0) / ms);
          const e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
          x = sx + (nx - sx) * e; y = sy + (ny - sy) * e; put();
          p < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    },
    ripple() {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;left:' + x + 'px;top:' + y + 'px;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:999px;border:2px solid rgba(0,0,0,.5)';
      document.body.appendChild(r);
      r.animate([{transform:'scale(1)',opacity:.9},{transform:'scale(4.2)',opacity:0}],
        {duration:550,easing:'cubic-bezier(.22,1,.36,1)'}).onfinish = () => r.remove();
    }
  };
})();`;

/** Dims everything except a window over what the narrator is discussing. */
const SPOTLIGHT = `
(() => {
  if (window.__spot) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;border-radius:14px;opacity:0;transition:opacity .45s ease, all .55s cubic-bezier(.22,1,.36,1);box-shadow:0 0 0 9999px rgba(15,23,42,.34);left:50%;top:50%;width:0;height:0';
  document.body.appendChild(el);
  window.__spot = {
    on(r, pad = 16) {
      el.style.left = (r.left - pad) + 'px'; el.style.top = (r.top - pad) + 'px';
      el.style.width = (r.width + pad*2) + 'px'; el.style.height = (r.height + pad*2) + 'px';
      el.style.opacity = '1';
    },
    off() { el.style.opacity = '0'; }
  };
})();`;

/** Eased scrolling — instant jumps read as cuts and disorient. */
const SCROLLER = `
window.__scrollTo = (top, ms) => new Promise((done) => {
  const start = scrollY, delta = top - start, t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    const e = p < .5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
    scrollTo(0, start + delta * e);
    p < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
});
window.__chapterTop = (id, off = 56) => {
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().top + scrollY - off : 0;
};`;

/* ------------------------------------------------------------------ */
/* Driving helpers                                                     */
/* ------------------------------------------------------------------ */

export async function dress(page) {
  for (const snippet of [CURSOR, SPOTLIGHT, SCROLLER]) await page.evaluate(snippet);
}

/** Waits until the page has genuinely stopped moving before measuring. */
export async function settle(page, timeout = 3000) {
  const started = Date.now();
  let last = -1, stable = 0;
  while (Date.now() - started < timeout) {
    const y = await page.evaluate(() => Math.round(scrollY));
    stable = y === last ? stable + 100 : 0;
    if (stable >= 300) return;
    last = y;
    await wait(100);
  }
}

export async function clickAt(page, text, { glide = 700 } = {}) {
  const point = await page.evaluate((needle) => {
    const el = [...document.querySelectorAll("button, a, [role=button]")]
      .find((n) => n.textContent.trim().includes(needle));
    if (!el) throw new Error("no clickable element containing: " + needle);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, text);
  await page.evaluate((p, ms) => window.__cursor.glide(p.x, p.y, ms), point, glide);
  await wait(glide + 90);
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => window.__cursor.ripple());
  await page.mouse.click(point.x, point.y);
  await wait(140);
}

export async function typeInto(page, selector, text, { delay = 26 } = {}) {
  const point = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(260, r.width / 2), y: r.top + 44 };
  }, selector);
  await page.evaluate((p, ms) => window.__cursor.glide(p.x, p.y, ms), point, 800);
  await wait(880);
  await page.mouse.click(point.x, point.y);
  await page.evaluate(() => window.__cursor.ripple());
  await page.keyboard.type(text, { delay });
}

export async function scrollToChapter(page, id, ms = 1600) {
  await page.evaluate((c, d) => window.__scrollTo(window.__chapterTop(c), d), id, ms);
  await wait(ms + 120);
}

/**
 * Spotlights an element for a while. `finder` runs in the page and returns an
 * element — a function rather than a selector, because the interesting targets
 * usually have no stable class to hang a selector on.
 */
export async function focusOn(page, finderSource, ms, pad = 18) {
  const found = await page.evaluate((src, padding) => {
    const el = new Function("return (" + src + ")()")();
    if (!el) return false;
    const r = el.getBoundingClientRect();
    window.__spot.on({ left: r.left, top: r.top, width: r.width, height: r.height }, padding);
    return true;
  }, finderSource, pad);
  if (!found) return;
  await wait(ms);
  await page.evaluate(() => window.__spot.off());
  await wait(400);
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: [`--window-size=${W},${H}`, "--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
await page.type("#pc", process.env.PASSCODE ?? "host2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit], form button")]);
await page.goto(BASE + "/", { waitUntil: "networkidle0" });
await wait(500);

const recorder = await page.screencast({ path: OUT, ffmpegPath: FFMPEG });
const t0 = Date.now();
const marks = {};

/**
 * Each beat owns a fixed slice of the timeline. Navigation, clicking and
 * scrolling all happen inside that slice, so overhead never pushes the picture
 * out of step with the voice.
 */
async function beat(id, label, action) {
  const startedAt = Date.now();
  marks[id] = (startedAt - t0) / 1000;
  console.log(`  ${marks[id].toFixed(1).padStart(6)}s  ${label}`);
  if (action) await action();
  const remaining = timings[id] * 1000 - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
}

try {
  // ================================================================
  const finder = {
    docTotals: `() => [...document.querySelectorAll('.doc td')].find(td => td.textContent.trim() === 'Balance Due')?.closest('table')`,
    docItems: `() => document.querySelector('.doc thead')?.closest('table')`,
    summary: `() => document.querySelector('main aside')`,
    stats: `() => document.querySelector('.grid.grid-cols-2')`,
    balanceCard: `() => document.querySelector('main aside section')`,
    lineTable: `() => document.querySelector('table.table')`,
  };
  const scrollToEl = async (src, off = 90, ms = 1200) => {
    await page.evaluate((s, o, d) => { const el = new Function('return (' + s + ')()')(); if (!el) return; const top = el.getBoundingClientRect().top + scrollY - o; return window.__scrollTo(Math.max(0, top), d); }, src, off, ms);
    await wait(ms + 150); await settle(page);
  };
  const clickSel = async (sel, { glide = 600 } = {}) => {
    const p = await page.evaluate((s) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); return { x: r.left + Math.min(200, r.width / 2), y: r.top + r.height / 2 }; }, sel);
    await page.evaluate((pt, ms) => window.__cursor.glide(pt.x, pt.y, ms), p, glide);
    await wait(glide + 80); await page.mouse.click(p.x, p.y); await page.evaluate(() => window.__cursor.ripple()); await wait(120);
  };
  const go = async (url) => { await page.goto(BASE + url, { waitUntil: "networkidle0" }); await wait(300); await dress(page); };

  await beat("01", "hook — dashboard", async () => {
    await dress(page);
    await wait(2500);
    await focusOn(page, finder.stats, 4200, 20);
  });

  await beat("02", "dashboard numbers", async () => {
    await wait(600);
    await focusOn(page, `() => document.querySelector('.grid.grid-cols-2 > div')`, 5200, 20);
  });

  await beat("03", "open the Cornerstone invoice", async () => {
    await clickAt(page, "INV-SHH1001");
    await page.waitForSelector(".doc", { timeout: 15000 });
    await wait(400); await dress(page);
    await wait(2200);
    await scrollToEl(finder.docItems, 140, 1400);
  });

  await beat("04", "tax lines", async () => {
    await scrollToEl(finder.docTotals, 260, 1400);
    await focusOn(page, finder.docTotals, 9000, 22);
  });

  await beat("05", "new invoice, pick customer", async () => {
    await go("/invoices/new");
    await wait(300);
    await clickSel('input[placeholder*="Search customers"]');
    await page.keyboard.type("Rot", { delay: 140 });
    await wait(500);
    await clickAt(page, "Old Sturbridge Rotary Club");
    await wait(300);
  });

  await beat("06", "lunch x40", async () => {
    await scrollToEl(finder.lineTable, 320, 1100);
    await clickSel('input[placeholder="Item name"]');
    await page.keyboard.type("lunch", { delay: 90 });
    await wait(600);
    await page.keyboard.press("Enter");
    await wait(300);
    await clickSel('table.table input[type=number]');
    await page.evaluate(() => document.querySelector('table.table input[type=number]').select());
    await page.keyboard.type("40", { delay: 160 });
    await page.keyboard.press("Tab");
  });

  await beat("07", "boardroom + summary", async () => {
    await page.evaluate(() => {
      const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'cat_boardroom'));
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'cat_boardroom'); sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wait(700);
    const total = await page.evaluate(() => document.querySelector('main aside').innerText);
    if (!total.includes("1,655.90")) throw new Error("summary mismatch: " + total.replace(/\n+/g, " / "));
    await focusOn(page, finder.summary, 14000, 18);
  });

  await beat("08", "save", async () => {
    await clickAt(page, "Save & mark as sent");
    await page.waitForFunction(() => location.pathname.startsWith("/invoices/inv_"), { timeout: 15000 });
    await page.waitForSelector(".doc", { timeout: 15000 });
    await wait(300); await dress(page);
    await focusOn(page, `() => document.querySelector('h1')`, 2600, 16);
  });

  await beat("09", "print view", async () => {
    const id = await page.evaluate(() => location.pathname.split("/")[2]);
    await go("/print/" + id);
    await wait(1200);
    await page.evaluate(() => window.__scrollTo(document.body.scrollHeight - innerHeight, 3200));
    await wait(3400);
    await page.evaluate(() => window.__scrollTo(0, 1200));
    await go("/invoices/" + id);
  });

  await beat("10", "record payment", async () => {
    await clickAt(page, "Record payment");
    await page.waitForSelector('[role=dialog] input[type=number]', { timeout: 5000 });
    await wait(300);
    await clickSel('[role=dialog] input[type=number]');
    await page.evaluate(() => document.querySelector('[role=dialog] input[type=number]').select());
    await page.keyboard.type("500", { delay: 150 });
    await clickSel('[role=dialog] input[placeholder^="Check"]');
    await page.keyboard.type("#1042", { delay: 90 });
    await wait(300);
    await clickAt(page, "Save payment");
    await page.waitForFunction(() => document.body.innerText.includes("Partially paid"), { timeout: 5000 });
    await wait(400);
    await focusOn(page, finder.balanceCard, 4500, 18);
  });

  await beat("11", "dashboard again", async () => {
    await go("/");
    await wait(500);
    await focusOn(page, finder.stats, 4200, 20);
  });

  await beat("12", "close", async () => {
    await wait(1500);
    await page.evaluate(() => window.__scrollTo(0, 800));
  });

  // ================================================================
} finally {
  await recorder.stop();
  await browser.close();
  fs.writeFileSync(path.join(ROOT, "beats.json"), JSON.stringify(marks, null, 1));
}
console.log(`\nrecorded ${((Date.now() - t0) / 1000).toFixed(1)}s → ${OUT}`);
