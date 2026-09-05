import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getActiveAnnouncement } from '../assets/js/announcements.js';

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
assert(homepage.includes('id="night"') && homepage.includes('id="visit"'), 'index.html: automatic theme needs its night and day section markers');
assert(themeScript.includes("mode === 'night' ? 'night' : getScrollTheme()") && themeScript.includes("if (mode === 'day')") && themeScript.includes("window.addEventListener('scroll'"), 'theme.js: day mode should retain automatic night sections while dark mode remains global');
assert(homepage.includes('<h1 id="hero-title"><span class="joy-word">joy</span><span class="hero-descriptor">Cafe &amp; Wine Bar</span></h1>'), 'index.html: hero heading should give joy its own larger line');
assert(homepage.includes('Nourishing food · simple plates · coffee · cheese · wine · good vibes. Pop in for a light bite, a drink or to book a table.'), 'index.html: hero introduction should use the current client copy');
assert(homepage.includes('Nourishing food.<br>Really good coffee.') && !homepage.includes('<li>Seasonal</li>'), 'index.html: day section should use the capitalised Nourishing food heading without the seasonal tag');
assert(!homepage.includes('Your table at Joy') && homepage.includes('If you’d like to book a table at Joy, please fill in the form below.'), 'index.html: booking introduction should use the requested copy without its old eyebrow');
assert(homepage.includes('our family-run women’s fashion, gifts and beauty therapy destination next door.'), 'index.html: ESSE note should use the shortened family-run description');
assert(homepage.includes('<h2 id="night-title">Thursday evenings at joy.</h2>') && homepage.includes('<li>Good food</li><li>Good wine</li><li>Good company</li>'), 'index.html: evening introduction should use the new Thursday heading and three themes');
assert(homepage.includes('Thursday 6pm – 9pm') && !homepage.includes('Friday 2pm – 6pm'), 'index.html: evening availability should be Thursday only');
assert(homepage.includes('Discover something different') && homepage.includes('organic, biodynamic and very tasty!'), 'index.html: wine introduction should use the new client copy');
assert(homepage.includes('Because you always need good coffee, right?') && homepage.includes('exclusive-to-Joy cinnamon buns.'), 'index.html: coffee section should include the new heading and bakes copy');
assert(homepage.includes('From 12pm, our beautiful courtyard will be open for outdoor seating.'), 'index.html: courtyard note should use the new opening-time copy');
assert(!homepage.includes('id="reviews"') && !homepage.includes('{{TESTIMONIALS}}'), 'index.html: testimonials section should be removed');
assert(homepage.indexOf('class="coffee-main"') < homepage.indexOf('class="coffee-inset"'), 'index.html: coffee images should use the main and inset composition');
assert(homepage.includes('class="nav-chevron"'), 'index.html: menus should use the centred chevron icon');
assert(homepage.includes('<small>Parking</small>Free parking available'), 'index.html: quick information should include parking availability');
assert(homepage.includes('id="booking-name"') && homepage.includes('id="booking-date"') && homepage.includes('id="booking-time"') && homepage.includes('Send reservation request'), 'index.html: reservation request form needs all key fields and its submit action');
assert(homepage.includes('id="booking-email"') && homepage.includes('id="booking-phone"') && homepage.includes('id="booking-requests"') && homepage.includes('id="booking-turnstile"'), 'index.html: reservation form needs contact, requests and Turnstile fields');
assert(!homepage.includes('booking-service') && !homepage.includes('Find a table'), 'index.html: old SumUp controls should be removed');
assert(!homepage.includes('<small>Plan a visit</small>') && !homepage.includes('class="button" href="#book">Book a Table</a><a class="text-link"'), 'index.html: removed booking CTAs should not remain');
assert(homepage.includes('<div><a class="button" href="mailto:info@joycafe28.com">Get in Touch</a></div>'), 'index.html: final CTA should lead with email contact');
assert(homepage.includes('class="announcement" id="announcement" aria-live="polite"><span>') && !homepage.includes('id="announcement" aria-live="polite"><span>Joy Cafe opens Wednesday 9 September. Bookings are now open.</span><a'), 'index.html: announcement should not include a booking link');
assert(!homepage.includes('↗') && homepage.includes('class="link-arrow"'), 'index.html: arrows should use Safari-safe line SVGs');
assert(homepage.includes('joy-cafe-melbourn-interior-mobile.avif'), 'index.html: mobile hero should use the optimized AVIF source');
assert(homepage.includes('/assets/brand/joy-main-logo.svg') && homepage.includes('/assets/documents/joy-wine-list.pdf'), 'index.html: updated logo and wine list should be linked');
assert(homepage.includes('/assets/images/marble-bg.webp'), 'index.html: marble texture should be included in the requested sections');
assert(homepage.includes('rgba(251,250,246,.9)'), 'index.html: marble texture should remain subtle beneath the light sage day background');
assert(homepage.includes('--page-bg:#fbfaf6') && homepage.includes('--sage:#acb095') && homepage.includes('--page-bg:#473f3a') && homepage.includes('--text:#fffaf6'), 'index.html: requested light palette and #473f3a white-text dark palette should be inlined');
assert(homepage.includes('.announcement{') && homepage.includes('background:var(--button);color:#fff') && homepage.includes('body[data-theme="night"] .announcement{background:#1f1b19;color:#fff}') && homepage.includes('border-top:1px solid var(--line)'), 'index.html: announcement should use distinct day and night colours and quick information should have its top rule');
assert(homepage.includes('body[data-theme="night"] .brand img,body[data-theme="night"] .footer-brand img{filter:invert(1) brightness(1.25)}'), 'index.html: header and footer logos should turn white in dark mode');
assert(!homepage.includes('Morning light') && !homepage.includes('<figcaption>'), 'index.html: editorial image captions should be removed');
assert(homepage.indexOf('class="portrait-main"') < homepage.indexOf('joy-cafe-story-main.jpg') && homepage.indexOf('class="portrait-inset"') < homepage.indexOf('steff-and-mike-at-joy-cafe.jpg'), 'index.html: story images should use the requested main and inset positions');
assert(!homepage.includes('Can I see the wine list online?'), 'index.html: online wine list FAQ should be removed');
const favicon = await readFile(path.join(root, 'favicon.ico'));
assert(favicon.length < 10_000 && favicon.readUInt16LE(2) === 1 && favicon.readUInt16LE(4) === 3, 'favicon.ico: expected an optimized three-size icon');
const wineList = await readFile(path.join(root, 'assets', 'documents', 'joy-wine-list.pdf'));
assert(wineList.subarray(0, 5).toString() === '%PDF-' && wineList.length > 1000, 'wine list: expected a valid linked PDF asset');
assert(!homepage.includes('<div class="footer-brand"><img src="/assets/brand/joy-logo.svg" alt="Joy Cafe & Wine Bar" width="900" height="820"><p>'), 'index.html: footer tagline should be removed');

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
