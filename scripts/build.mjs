import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const readJson = async (name) => JSON.parse(await readFile(path.join(root, 'data', name), 'utf8'));
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const assert = (condition, message) => { if (!condition) throw new Error(`Build validation failed: ${message}`); };
const to24Hour = (value) => {
  const match = value.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  assert(match, `opening time "${value}" is not valid.`);
  let hour = Number(match[1]);
  if (match[3] === 'pm' && hour !== 12) hour += 12;
  if (match[3] === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${match[2] || '00'}`;
};

const [site, menu, booking, faqs, announcements] = await Promise.all([
  readJson('site.json'), readJson('menu.json'), readJson('booking.json'), readJson('faqs.json'), readJson('announcements.json')
]);

assert(site.name && site.domain && site.email && site.address?.postcode, 'site.json is missing required business information.');
assert(Array.isArray(menu.daytime?.items) && menu.daytime.items.length, 'menu.json needs daytime menu items.');
assert(Array.isArray(menu.evening?.items) && menu.evening.items.length, 'menu.json needs evening menu items.');
assert(Array.isArray(booking.partySizes) && booking.identifier && booking.apiBaseUrl?.startsWith('https://') && booking.fallbackUrl?.startsWith('https://'), 'booking.json is invalid.');
assert(Array.isArray(faqs) && faqs.every((item) => item.question && item.answer), 'faqs.json contains an invalid FAQ.');
assert(Array.isArray(announcements), 'announcements.json must be an array.');

const renderMenu = (items) => items.map((item) => `<article class="menu-item">
  ${item.group ? `<p class="menu-group">${escapeHtml(item.group)}</p>` : ''}
  <h3>${escapeHtml(item.name)}</h3><p class="price">${escapeHtml(item.price)}</p>
  ${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}
</article>`).join('\n');

const renderFaqs = () => faqs.map((item, index) => `<article class="faq-item">
  <h3><button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-answer-${index + 1}"><span>${escapeHtml(item.question)}</span><span aria-hidden="true">+</span></button></h3>
  <div class="faq-answer" id="faq-answer-${index + 1}" role="region" aria-hidden="true" aria-labelledby="faq-question-${index + 1}"><div><p>${escapeHtml(item.answer)}</p></div></div>
</article>`.replace('class="faq-question"', `class="faq-question" id="faq-question-${index + 1}"`)).join('\n');

const renderHours = () => site.hours.map((item) => `<div class="hours-row"><span>${escapeHtml(item.day)}</span><span>${item.times.map((time) => `<em>${escapeHtml(time)}</em>`).join('')}</span></div>`).join('\n');

const businessSchema = {
  '@context': 'https://schema.org',
  '@type': ['CafeOrCoffeeShop', 'BarOrPub'],
  name: site.name,
  url: site.domain,
  description: 'A family-run cafe and wine bar in Melbourn serving seasonal brunch and lunch, Wood Street Coffee, cheese, charcuterie and wine.',
  image: `${site.domain}/assets/images/joy-cafe-melbourn-interior-1440.webp`,
  logo: `${site.domain}/assets/brand/joy-logo.png`,
  telephone: site.telephone,
  email: site.email,
  address: { '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.locality, postalCode: site.address.postcode, addressCountry: 'GB' },
  openingHoursSpecification: site.hours.filter((entry) => entry.times[0] !== 'Closed').flatMap((entry) => entry.times.map((time) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: entry.day, opens: to24Hour(time.split(' – ')[0]), closes: to24Hour(time.split(' – ')[1]) }))),
  sameAs: [site.instagram],
  hasMenu: [`${site.domain}/#day-menu`, `${site.domain}/#evening-menu`]
};
const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };

let homepage = await readFile(path.join(root, 'src', 'index.template.html'), 'utf8');
const inlineCss = await readFile(path.join(root, 'assets', 'css', 'styles.css'), 'utf8');
const replacements = {
  INLINE_CSS: inlineCss,
  LOCAL_BUSINESS_JSONLD: safeJson(businessSchema), FAQ_JSONLD: safeJson(faqSchema),
  PARTY_OPTIONS: booking.partySizes.map((size) => `<option value="${size}">${size} ${size === 1 ? 'person' : 'people'}</option>`).join(''),
  SERVICE_OPTIONS: booking.services.map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.label)}</option>`).join(''),
  DAY_MENU_TITLE: escapeHtml(menu.daytime.title), DAY_MENU_AVAILABILITY: escapeHtml(menu.daytime.availability), DAY_MENU_INTRO: escapeHtml(menu.daytime.intro), DAY_MENU_ITEMS: renderMenu(menu.daytime.items), DAY_ALLERGY_NOTE: escapeHtml(menu.daytime.allergyNote),
  EVENING_MENU_TITLE: escapeHtml(menu.evening.title), EVENING_MENU_AVAILABILITY: escapeHtml(menu.evening.availability), EVENING_MENU_INTRO: escapeHtml(menu.evening.intro), EVENING_MENU_ITEMS: renderMenu(menu.evening.items), EVENING_ADDITIONAL_NOTE: escapeHtml(menu.evening.additionalNote), EVENING_ALLERGY_NOTE: escapeHtml(menu.evening.allergyNote),
  OPENING_HOURS: renderHours(), FAQ_ITEMS: renderFaqs(), DIRECTIONS_URL: escapeHtml(site.map.directionsUrl)
};
for (const [key, value] of Object.entries(replacements)) homepage = homepage.replaceAll(`{{${key}}}`, value);
assert(!homepage.includes('{{'), 'an unresolved homepage template token remains.');
await writeFile(path.join(root, 'index.html'), homepage);

const legalFooter = `<footer class="site-footer"><div class="footer-brand"><img src="/assets/brand/joy-main-logo.svg" alt="Joy Cafe & Wine Bar" width="900" height="820"></div><div><h2>Visit</h2><address>28 Station Road<br>Melbourn<br>Royston<br>SG8 6DX</address></div><div><h2>Contact</h2><a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a><a href="${escapeHtml(site.telephoneHref)}">${escapeHtml(site.telephone)}</a></div><div><h2>Legal</h2><a href="/privacy-policy.html">Privacy Policy</a><a href="/cookie-policy.html">Cookie Policy</a><a href="/terms.html">Website Terms</a></div><div class="footer-bottom"><p>© 2026 Joy Cafe Ltd</p><p>Company No. ${escapeHtml(site.companyNumber)}</p><p>Website designed by <a href="https://websi.com/" target="_blank" rel="noopener noreferrer">Websi</a></p></div></footer>`;
const legalPage = ({ title, description, slug, body }) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Joy Cafe Melbourn</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${site.domain}/${slug}"><meta name="robots" content="index,follow"><meta name="theme-color" content="#fbfaf6"><link rel="icon" href="/assets/brand/joy-favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/styles.css"><script type="module" src="/assets/js/navigation.js"></script></head><body class="legal-page" data-theme="day"><a class="skip-link" href="#main">Skip to content</a><header class="site-header simple-header"><a class="brand" href="/" aria-label="Joy Cafe home"><img src="/assets/brand/joy-main-logo.svg" alt="" width="900" height="820"></a><nav class="primary-nav" aria-label="Legal page navigation"><a href="/">Home</a><a href="/#day-menu">Menus</a><a href="/#visit">Visit</a></nav><a class="button header-book" href="/#book">Book a Table</a></header><main id="main"><div class="legal-header"><div><p class="eyebrow">Joy Cafe & Wine Bar</p><h1>${escapeHtml(title)}</h1></div></div><article class="legal-content">${body}</article></main>${legalFooter}</body></html>`;

const privacyBody = `<p><strong>Last updated: 3 September 2026</strong></p><p>This policy explains how ${escapeHtml(site.company)} handles personal information when you visit our website or contact us.</p><h2>Who we are</h2><p>${escapeHtml(site.company)} (company number ${escapeHtml(site.companyNumber)}) operates Joy Cafe & Wine Bar at ${escapeHtml(site.address.street)}, ${escapeHtml(site.address.locality)}, ${escapeHtml(site.address.town)}, ${escapeHtml(site.address.postcode)}. Contact us at <a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>.</p><h2>Information you choose to share</h2><p>This website has no contact form, account, newsletter, ecommerce or analytics. You may choose to contact us by email or telephone. We use the information you provide only to answer your enquiry, manage a booking, or provide the service you request.</p><h2>Table bookings</h2><p>Bookings are completed on SumUp's external booking service. SumUp processes the information you enter under its own privacy terms. We receive the booking details needed to manage your visit.</p><h2>Technical information</h2><p>Our hosting provider may process ordinary server logs, such as IP address, browser type, requested page and time of access, to operate and secure the website. These records are retained only as needed for security and service operation.</p><h2>Sharing and retention</h2><p>We do not sell personal information. We share it only with service providers where needed to run the website or booking service, or where required by law. We keep correspondence and booking information only for as long as reasonably needed for the purpose it was collected and our legal obligations.</p><h2>Your rights</h2><p>UK data protection law may give you rights to access, correct, erase or restrict the use of your personal information, and to object or complain. Contact us first at <a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>. You may also contact the Information Commissioner's Office.</p><h2>External links</h2><p>Links to SumUp, Instagram, map services and other websites take you to services with their own privacy policies.</p>`;
const cookieBody = `<p><strong>Last updated: 3 September 2026</strong></p><p>Joy Cafe's website does not intentionally use analytics cookies, advertising cookies or tracking pixels.</p><h2>Day and night preference</h2><p>If you manually choose the Day or Night appearance, that choice is stored in your browser's <code>sessionStorage</code>. It lasts only for the current browsing session and is not a cookie.</p><h2>Announcements</h2><p>The opening announcement is checked against the current date. We do not use cookies or local storage to remember it.</p><h2>External services</h2><p>We do not load a map until you choose “Show Map”. If you continue to SumUp to book, visit Instagram, open the map or follow another external link, that provider may use cookies under its own policy. You can control cookies through your browser settings.</p><h2>Changes</h2><p>If we introduce analytics or another feature that requires non-essential cookies, we will update this policy and provide an appropriate choice before those cookies are set.</p><h2>Contact</h2><p>Questions? Email <a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>.</p>`;
const termsBody = `<p><strong>Last updated: 3 September 2026</strong></p><p>These terms apply to your use of the Joy Cafe & Wine Bar website.</p><h2>Website information</h2><p>We aim to keep information accurate and useful, but menus, prices, seasonal dishes and opening hours may change. Please contact us if you need to confirm something before travelling.</p><h2>Bookings</h2><p>Table bookings are completed through SumUp, an external service. Its terms and privacy information also apply when you use that service.</p><h2>Allergies</h2><p>Please tell us about allergies or dietary requirements when booking and again when you arrive. We will always do our best to accommodate you, but the website is not a substitute for discussing your needs directly with our team.</p><h2>External links</h2><p>Links to other websites are provided for convenience. We do not control their content, availability or privacy practices.</p><h2>Intellectual property</h2><p>The Joy name, logo, website design, copy and original photography are owned by or licensed to ${escapeHtml(site.company)}. Please do not reproduce them without permission.</p><h2>Availability and liability</h2><p>We may update, suspend or withdraw parts of the website. Nothing in these terms excludes rights or responsibilities that cannot lawfully be excluded, including your statutory consumer rights.</p><h2>Law</h2><p>These terms are governed by English law, and disputes are subject to the jurisdiction of the courts of England and Wales.</p><h2>Contact</h2><p>${escapeHtml(site.company)}, ${escapeHtml(site.address.street)}, ${escapeHtml(site.address.locality)}, ${escapeHtml(site.address.town)}, ${escapeHtml(site.address.postcode)}. Email <a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>.</p>`;

await Promise.all([
  writeFile(path.join(root, 'privacy-policy.html'), legalPage({ title: 'Privacy Policy', description: 'How Joy Cafe Ltd handles personal information on the Joy Cafe website.', slug: 'privacy-policy.html', body: privacyBody })),
  writeFile(path.join(root, 'cookie-policy.html'), legalPage({ title: 'Cookie Policy', description: 'Cookies and browser storage used by the Joy Cafe website.', slug: 'cookie-policy.html', body: cookieBody })),
  writeFile(path.join(root, 'terms.html'), legalPage({ title: 'Website Terms', description: 'Terms for using the Joy Cafe & Wine Bar website.', slug: 'terms.html', body: termsBody }))
]);

const errorPage = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Joy Cafe Melbourn</title><meta name="robots" content="noindex"><link rel="icon" href="/assets/brand/joy-favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/styles.css"></head><body data-theme="day"><header class="site-header simple-header"><a class="brand" href="/" aria-label="Joy Cafe home"><img src="/assets/brand/joy-main-logo.svg" alt="" width="900" height="820"></a><a class="button header-book" href="/#book">Book a Table</a></header><main class="error-page"><div><p class="eyebrow">404 — Page not found</p><h1>Looks like this one's<br>off the menu.</h1><p>The page you're looking for couldn't be found.</p><div class="error-actions"><a class="button" href="/">Back to Joy</a><a class="button button-ghost" href="/#book">Book a Table</a></div></div></main></body></html>`;
await writeFile(path.join(root, '404.html'), errorPage);

await writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.domain}/sitemap.xml\n`);
await writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site.domain}/</loc></url>\n  <url><loc>${site.domain}/privacy-policy.html</loc></url>\n  <url><loc>${site.domain}/cookie-policy.html</loc></url>\n  <url><loc>${site.domain}/terms.html</loc></url>\n</urlset>\n`);
await writeFile(path.join(root, 'site.webmanifest'), JSON.stringify({ name: site.name, short_name: 'Joy Cafe', description: 'Healthy by day, naughty by night.', start_url: '/', display: 'standalone', background_color: '#fbfaf6', theme_color: '#fbfaf6', icons: [{ src: '/assets/brand/joy-favicon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));

const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ['index.html', 'privacy-policy.html', 'cookie-policy.html', 'terms.html', '404.html', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'favicon.ico', 'assets', 'data']) {
  const source = path.join(root, item);
  if (existsSync(source)) await cp(source, path.join(out, item), { recursive: true });
}
console.log('Validated content and built static site to dist/.');
