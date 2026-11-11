#!/usr/bin/env node
/**
 * Renders the PWA icons and the social preview from public/icons/icon.svg.
 *   node scripts/build-icons.mjs
 * Uses the Chromium that ships with @playwright/test (dev dependency).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'public', 'icons');
const svg = readFileSync(join(ICONS, 'icon.svg'), 'utf8');
const mark = svg.match(/<g fill="none"[\s\S]*?<\/g>/)[0];

const tile = (size, { rounded = true, pad = 0 } = {}) => `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3EA66D"/><stop offset="1" stop-color="#143C25"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="110"' : ''} fill="url(#g)"/>
  <g transform="translate(${256 - (256 - pad) * 0.731} ${256 - (256 - pad) * 0.731}) scale(${((512 - pad * 2) / 512) * 0.731 * 1.368})">
    <g transform="translate(-68.8 -68.8)">${mark}</g>
  </g>
</svg></body></html>`;

const og = `<!doctype html><html dir="rtl"><head><style>
body{margin:0;width:1200px;height:630px;display:flex;align-items:center;justify-content:center;gap:56px;
background:radial-gradient(700px 400px at 85% 10%,rgba(252,211,77,.18),transparent 70%),linear-gradient(135deg,#0f5132,#047857 60%,#059669);
font-family:'Amiri','Noto Naskh Arabic',serif;color:#fff}
h1{font-size:150px;margin:0;line-height:1}
p{font-family:'Cairo','Segoe UI',sans-serif;font-size:34px;margin:18px 0 0;opacity:.92}
</style></head><body>
<div><h1>تراتيل</h1><p>المصحف · التلاوة · التفسير · الأذكار · المواقيت</p></div>
${svg.replace('<svg ', '<svg width="300" height="300" ')}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ['icon-192.png', 192, tile(192)],
  ['icon-512.png', 512, tile(512)],
  ['apple-touch-icon.png', 180, tile(180, { rounded: false })],
  ['icon-maskable-512.png', 512, tile(512, { rounded: false, pad: 70 })],
];
for (const [name, size, html] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: join(ICONS, name), omitBackground: true });
  console.log('✓', name);
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.waitForTimeout(300);
await page.screenshot({ path: join(ICONS, 'og.png') });
console.log('✓ og.png');
await browser.close();
