#!/usr/bin/env node
// Drive a real, logged-in Chrome session to generate an image in ChatGPT and
// save it into the repo. Uses YOUR session in a real browser window — no API,
// no billing. First run once with `--login` to sign in; the session persists.
//
// Usage:
//   node gen.mjs --login
//   node gen.mjs "a cozy pixel-art coffee shop, warm light" --out ../../assets/images/foo.png
//   node gen.mjs "..." --out path.png --raw        (don't prepend "Generate an image:")
//   node gen.mjs "..." --out path.png --show        (keep window open at the end)
//
// It types like a person (variable speed, small pauses) and uses your real
// Chrome profile so the page behaves as if you were clicking yourself.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(__dirname, ".profile"); // persisted login (gitignored)
const CHATGPT_URL = "https://chatgpt.com/";

// ---- tiny arg parser --------------------------------------------------------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positional = argv.filter((a) => !a.startsWith("--"));
function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
}
function flagValues(name) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && argv[i + 1] && !argv[i + 1].startsWith("--")) out.push(argv[i + 1]);
  }
  return out;
}
const LOGIN = flags.has("--login");
const RAW = flags.has("--raw");
const SHOW = flags.has("--show");
const OUT = flagValue("--out");
const REFS = flagValues("--ref").map((p) => (isAbsolute(p) ? p : resolve(process.cwd(), p)));
const PROMPT = positional.join(" ").trim();

// ---- human-ish helpers ------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rint = (min, max) => Math.floor(min + Math.random() * (max - min));
async function humanPause(min = 350, max = 1100) { await sleep(rint(min, max)); }

async function humanType(page, text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    await page.keyboard.type(ch, { delay: 0 });
    // Base cadence is slower and more variable than a bot's uniform tap.
    let d = rint(45, 150);
    if (ch === " ") d += rint(40, 170); // brief beat between words
    if (/[.,!?;:]/.test(ch)) d += rint(160, 420); // pause after punctuation
    if (Math.random() < 0.09) d += rint(300, 950); // occasional "thinking" gap
    if (Math.random() < 0.02) d += rint(700, 1500); // rare longer pause
    await sleep(d);
  }
}

async function humanClick(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.hover().catch(() => {});
  await humanPause(120, 380);
  await locator.click();
}

// ---- main -------------------------------------------------------------------
async function main() {
  if (!LOGIN && !PROMPT) {
    console.error('Give a prompt, e.g.  node gen.mjs "a red bakery cat sticker" --out ../../assets/images/cat.png');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: false,
    viewport: null, // use the real window size
    acceptDownloads: true, // needed to capture the true (transparent) PNG via the download button
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(60_000);

  try {
    await page.goto(CHATGPT_URL, { waitUntil: "domcontentloaded" });
    await humanPause(800, 1600);

    if (LOGIN) {
      console.log("\n>>> A Chrome window is open. Log into ChatGPT in it.");
      console.log(">>> I'll detect it automatically once the chat box appears — no keypress needed.\n");
      const deadline = Date.now() + 300_000; // 5 min to finish logging in
      while (Date.now() < deadline) {
        const cookies = await context.cookies("https://chatgpt.com");
        const authed = cookies.some(
          (c) => /session-token|__Secure-next-auth\.session-token/i.test(c.name) && c.value
        );
        if (authed) {
          await humanPause(1500, 2500); // let the session settle
          console.log('✓ Logged in for real (session cookie present). Ready — run:  npm run gen -- "your prompt" --out path.png');
          return;
        }
        await sleep(2000);
      }
      console.error("Timed out waiting for login (5 min). Run `npm run login` again.");
      process.exit(2);
    }

    // Are we actually logged in? Look for the composer.
    const composer = page.locator('#prompt-textarea, div[contenteditable="true"]').first();
    if (!(await composer.count()) || !(await composer.isVisible().catch(() => false))) {
      console.error("\nNot logged in (no chat box found). Run:  npm run login\n");
      process.exit(2);
    }

    const message = RAW ? PROMPT : `Generate an image: ${PROMPT}`;

    // Attach reference image(s) first, so the model sees them with the prompt.
    if (REFS.length) {
      console.log(`Attaching ${REFS.length} reference image(s)...`);
      await attachRefs(page, REFS);
      await humanPause(600, 1400);
    }

    await humanClick(composer);
    await humanPause(300, 800);
    await humanType(page, message);
    await humanPause(400, 1000);
    await page.keyboard.press("Enter");
    console.log("Prompt sent. Waiting for the image (can take up to ~3 min)...");

    const src = await waitForGeneratedImage(page);
    if (typeof src === "string" && src.startsWith("BLOCKED:")) {
      console.error(`\nBLOCKED by ChatGPT: ${src.slice(8)}`);
      console.error("Likely an image/rate cap or a content-policy refusal. Stop the batch and resume later.");
      process.exit(4);
    }
    if (!src) {
      const shot = resolve(__dirname, "last-debug.png");
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.error(`\nCouldn't find a generated image. Saved a debug screenshot: ${shot}`);
      console.error("The page layout may have changed — send me last-debug.png and I'll adjust the selectors.");
      process.exit(3);
    }

    const bytes = await captureImageBytes(page, src);
    const outPath = resolveOut(OUT);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, bytes);
    console.log(`\n✓ Saved image -> ${outPath}  (${(bytes.length / 1024).toFixed(0)} KB)`);
  } finally {
    if (SHOW && !LOGIN) {
      console.log("(--show) Leaving the window open. Close it yourself when done.");
    } else {
      await humanPause(400, 900);
      await context.close();
    }
  }
}

function resolveOut(out) {
  if (!out) return resolve(__dirname, `out-${Date.now()}.png`);
  return isAbsolute(out) ? out : resolve(process.cwd(), out);
}

// Upload reference image(s) into the composer via the hidden file input.
async function attachRefs(page, refs) {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 15_000 }).catch(() => {});
  await input.setInputFiles(refs);
  // Wait for the composer to show the upload previews (blob thumbnails) before typing.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate((n) => {
      const form = document.querySelector("form") || document.body;
      const thumbs = Array.from(form.querySelectorAll("img")).filter((im) => {
        const s = im.currentSrc || im.src || "";
        return s.startsWith("blob:") || /oaiusercontent/i.test(s);
      });
      return thumbs.length >= n;
    }, refs.length);
    if (ready) return;
    await sleep(1500);
  }
  console.log("(refs may still be uploading; proceeding)");
}

// Look for a rate-limit / content-policy banner so we fail loudly instead of
// timing out silently. Returns a short reason string, or null.
async function detectBlocker(page) {
  return await page.evaluate(() => {
    const txt = (document.querySelector("main")?.innerText || "").toLowerCase();
    const hits = [
      "you've reached your limit",
      "reached the limit",
      "image generation limit",
      "limit for generating images",
      "please try again later",
      "come back later",
      "can't help with that",
      "unable to generate",
      "violates our",
      "content policy",
    ];
    const found = hits.find((h) => txt.includes(h));
    return found || null;
  });
}

// Poll the latest assistant turn for a real generated image, and wait until its
// src stops changing (placeholder -> final).
async function waitForGeneratedImage(page, { timeoutMs = 260_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSrc = null;
  let stableSince = 0;
  while (Date.now() < deadline) {
    const src = await page.evaluate(() => {
      // Look at conversation images, but EXCLUDE the user's uploaded reference
      // thumbnails (those live inside a user-authored message). The generated
      // image's viewer isn't tagged "assistant", so we can't require that — we
      // just skip anything under a user turn.
      const imgs = Array.from(document.querySelectorAll("main img")).filter((im) => {
        if (im.closest('[data-message-author-role="user"]')) return false; // uploaded ref
        return im.naturalWidth >= 256 && im.naturalHeight >= 256;
      });
      const best = imgs.sort(
        (a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight
      )[0];
      return best ? best.currentSrc || best.src : null;
    });

    if (src) {
      if (src === lastSrc) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince > 2500) return src; // stable ~2.5s => final
      } else {
        lastSrc = src;
        stableSince = 0;
      }
    } else {
      // No image yet — check for a cap/policy banner so we don't wait 3 min for nothing.
      const blocker = await detectBlocker(page);
      if (blocker) return `BLOCKED:${blocker}`;
    }
    await sleep(1500);
  }
  return lastSrc; // best effort
}

// Prefer ChatGPT's own Download button — it hands back the TRUE asset (with real
// alpha for transparent images). Fall back to fetching the inline src (which is a
// flattened, checkerboard preview) if the button can't be found/clicked.
async function captureImageBytes(page, src) {
  // Reveal the on-image controls: hover the generated image.
  await page
    .evaluate((url) => {
      const img = Array.from(document.querySelectorAll("main img")).find(
        (im) => (im.currentSrc || im.src) === url
      );
      if (img) img.scrollIntoView({ block: "center" });
    }, src)
    .catch(() => {});

  // Find a download control near the latest generated image and mark it.
  const marked = await page.evaluate(() => {
    document.querySelectorAll("[data-dl-target]").forEach((e) => e.removeAttribute("data-dl-target"));
    const controls = Array.from(document.querySelectorAll("main button, main a"));
    const looksDownload = (el) => {
      if (el.tagName === "A" && el.hasAttribute("download")) return true;
      const s = [
        el.getAttribute("aria-label"),
        el.getAttribute("title"),
        el.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return /\bdownload\b|save image|save picture|下载|保存|ダウンロード|저장/.test(s);
    };
    const matches = controls.filter(looksDownload);
    const found = matches[matches.length - 1]; // most recent message's control
    if (found) {
      found.setAttribute("data-dl-target", "1");
      return true;
    }
    return false;
  });

  if (marked) {
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.locator('[data-dl-target="1"]').click(),
      ]);
      const p = await download.path();
      if (p) {
        const buf = await readFile(p);
        console.log("(captured via Download button — real asset)");
        return buf;
      }
    } catch (e) {
      console.log(`(download button failed: ${e.message}; falling back to inline fetch)`);
    }
  } else {
    console.log("(no download button found; using inline image fetch — may be flattened)");
  }
  return await fetchInlineBytes(page, src);
}

// Fetch the image bytes from inside the page so the session cookies apply.
async function fetchInlineBytes(page, src) {
  const dataUrl = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(blob);
    });
  }, src);
  const base64 = String(dataUrl).split(",")[1] || "";
  return Buffer.from(base64, "base64");
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
