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

- Business details and opening hours: `data/site.json`
- Brunch/lunch and evening menus: `data/menu.json`
- Booking destination and choices: `data/booking.json`
- Time-limited notices: `data/announcements.json`
- FAQs: `data/faqs.json`
- Testimonials: `data/testimonials.json`

Run `npm run build` after editing content. The build validates the JSON, renders menus and FAQs into static HTML, optimises the supplied photography, and rebuilds all pages.

## Hosting

Upload the contents of `dist/` to Cloudflare Pages, GitHub Pages, or any conventional static host. The project includes the configuration needed for OpenAI Sites hosting.
