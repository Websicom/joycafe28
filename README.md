# Joy Cafe & Wine Bar website

A framework-free static website for [joycafe28.com](https://joycafe28.com), built with semantic HTML, modern CSS and small vanilla JavaScript modules.

## Development

```bash
npm install
npm run dev
```

The local address is printed in the terminal. Restart the command after changing source or content files so the generated pages are refreshed.

## Production build

```bash
npm run build
```

The deployable static website is written to `dist/`.

## Updating content

- Business details: `data/site.json`
- Opening hours, reservation slots and validation limits: `shared/reservations.js`
- Brunch/lunch and evening menus: `data/menu.json`
- Time-limited notices: `data/announcements.json`
- FAQs: `data/faqs.json`
- Testimonials: `data/testimonials.json`

Run `npm run build` after editing content. The build validates the JSON, renders menus and FAQs into static HTML, optimises the supplied photography, and rebuilds all pages.

## Hosting

The site is deployed to Cloudflare Pages. Its `/api/reservations` Pages Function forwards requests over a private service binding named `BOOKING_SERVICE` to the `joycafe28-reservations` Worker. The Worker uses Cloudflare Turnstile, native rate limiting and a destination-restricted Email Service binding named `BOOKING_EMAIL`.

Deploy the Worker after its Cloudflare Email Sending domain, verified destination and Turnstile keys have been configured:

```bash
npx wrangler secret put TURNSTILE_SITE_KEY --config wrangler.reservations.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.reservations.jsonc
npm run deploy:reservations
```

The same deployment is available as the manually triggered **Deploy reservation Worker** GitHub Actions workflow.

Then connect the Pages `BOOKING_SERVICE` service binding to `joycafe28-reservations` and redeploy the Pages project.
