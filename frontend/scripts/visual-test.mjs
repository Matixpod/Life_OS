import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = path.resolve(process.cwd(), '../screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';
const ROUTES = [
  { name: 'dashboard', path: '/' },
  { name: 'cognitive', path: '/cognitive' },
  { name: 'intelligence', path: '/intelligence' },
  { name: 'review', path: '/review' },
  { name: 'goals', path: '/goals' },
  { name: 'sleep', path: '/sleep' },
  { name: 'profile', path: '/profile' },
];

const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 375, height: 812 },
];

const errors = [];

process.env.LD_LIBRARY_PATH = [
  '/tmp/chrome-deps/extract/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH || '',
].filter(Boolean).join(':');

const browser = await chromium.launch({
  executablePath:
    '/home/matixpod/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
});

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${vp.tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${vp.tag}] console.error: ${m.text()}`);
  });

  // Pre-set localStorage to suppress morning popup so the dashboard renders cleanly.
  await page.addInitScript(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`lifeos_morning_${today}`, JSON.stringify({ done: true }));
  });

  for (const r of ROUTES) {
    const url = `${BASE}${r.path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      errors.push(`[${vp.tag}] navigate ${url}: ${e.message}`);
    }
    await page.waitForTimeout(800);
    const file = path.join(OUT, `${r.name}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${r.name} (${vp.tag}) → ${path.relative(process.cwd(), file)}`);
  }

  await ctx.close();
}

await browser.close();

if (errors.length) {
  console.log('\n--- Console / page errors ---');
  for (const e of errors) console.log('  ' + e);
  process.exit(0);
} else {
  console.log('\nNo console / page errors.');
}
