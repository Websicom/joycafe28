import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getActiveAnnouncement } from '../assets/js/announcements.js';
import { getBookingWeek } from '../assets/js/booking.js';

const root = path.resolve(import.meta.dirname, '..');
const pages = ['index.html', 'privacy-policy.html', 'cookie-policy.html', 'terms.html', '404.html'];
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const exists = async (filename) => { try { return (await stat(filename)).isFile(); } catch { return false; } };

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  assert(!html.includes('{{'), `${page}: unresolved template token`);
  assert((html.match(/<h1(?:\s|>)/g) || []).length === 1, `${page}: expected exactly one h1`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert(ids.length === new Set(ids).size, `${page}: duplicate id`);
  for (const match of html.matchAll(/href="#([^"?]+)"/g)) assert(ids.includes(match[1]), `${page}: broken anchor #${match[1]}`);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)) {
    const localPath = match[1] === '/' ? '/index.html' : match[1];
    assert(await exists(path.join(root, localPath)), `${page}: missing local asset ${match[1]}`);
  }
}

const homepage = await readFile(path.join(root, 'index.html'), 'utf8');
const themeScript = await readFile(path.join(root, 'assets', 'js', 'theme.js'), 'utf8');
for (const match of homepage.matchAll(/<img\s+([^>]+)>/g)) {
  assert(/\salt="[^"]*"/.test(` ${match[1]}`), `index.html: image missing alt text`);
  assert(/\swidth="\d+"/.test(` ${match[1]}`) && /\sheight="\d+"/.test(` ${match[1]}`), `index.html: image missing width or height`);
}
for (const match of homepage.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(match[1]); } catch (error) { errors.push(`index.html: invalid JSON-LD (${error.message})`); }
}
assert((homepage.match(/<script type="application\/ld\+json">/g) || []).length === 2, 'index.html: expected business and FAQ JSON-LD');
assert(!homepage.includes('<a href="#coffee">Coffee</a>'), 'index.html: coffee should not appear as a navigation link');
assert(homepage.includes('id="theme-mode"') && !homepage.includes('id="theme-auto"'), 'index.html: expected the compact theme icon control');
assert(homepage.includes('<style>@font-face') && !homepage.includes('<link rel="stylesheet" href="/assets/css/styles.css">'), 'index.html: homepage CSS should be inlined for first-paint performance');
assert(!homepage.includes('data-mode="auto"') && !homepage.includes('theme-icon-auto'), 'index.html: theme control should offer light and dark modes only');
assert(homepage.includes('id="night"') && homepage.includes('id="reviews"'), 'index.html: automatic theme needs its night and day section markers');
assert(themeScript.includes('override || getScrollTheme()') && themeScript.includes("window.addEventListener('scroll'"), 'theme.js: automatic scroll theme should remain the default');
assert(homepage.includes('<h1 id="hero-title"><span>joy Cafe &amp;</span> <span>Wine Bar</span></h1>'), 'index.html: hero heading should use the requested two-line wordmark');
assert(homepage.includes('Tasty food.<br>Really good coffee.'), 'index.html: day heading should say Tasty food');
assert(homepage.includes('Kind words,<br>lovingly shared.'), 'index.html: reviews heading should use the requested wording');
assert(homepage.indexOf('class="coffee-main"') < homepage.indexOf('class="coffee-inset"'), 'index.html: coffee images should use the main and inset composition');
assert(homepage.includes('class="nav-chevron"'), 'index.html: menus should use the centred chevron icon');
assert(homepage.includes('class="quick-info-action"'), 'index.html: plan-a-visit action should keep its arrow inline');
assert(homepage.includes('id="booking-date"') && homepage.includes('Find a table'), 'index.html: booking form needs a date and Find a table action');
assert(!homepage.includes('<div class="footer-brand"><img src="/assets/brand/joy-logo.svg" alt="Joy Cafe & Wine Bar" width="900" height="820"><p>'), 'index.html: footer tagline should be removed');

const bookingWeek = getBookingWeek('2026-09-09');
assert(bookingWeek.startDate === '2026-09-07' && bookingWeek.endDate === '2026-09-13', 'booking date should resolve to its surrounding Monday and Sunday');

const announcements = JSON.parse(await readFile(path.join(root, 'data', 'announcements.json'), 'utf8'));
assert(getActiveAnnouncement(announcements, new Date('2026-09-09T22:00:00+01:00'))?.id === 'opening-2026', 'opening announcement should be active on 9 September');
assert(!getActiveAnnouncement(announcements, new Date('2026-09-10T00:00:00+01:00')), 'opening announcement should expire on 10 September');

const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
assert(!sitemap.includes('404.html'), 'sitemap must not contain the 404 page');
assert((sitemap.match(/<url>/g) || []).length === 4, 'sitemap should contain four URLs');
for (const page of [...pages, 'robots.txt', 'sitemap.xml', 'site.webmanifest']) assert(await exists(path.join(root, 'dist', page)), `dist: missing ${page}`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('QA passed: pages, assets, anchors, metadata, structured data and announcement dates are valid.');
}
