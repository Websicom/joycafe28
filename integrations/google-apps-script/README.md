# Google Apps Script handoff

This folder contains the complete Google-side reservation email handler. It is intentionally separate from the public website build.

The script must be created and deployed while signed in as `steff@joycafe28.com`. Add a Script Property named `BOOKING_WEBHOOK_SECRET`, deploy as a Web app that executes as the deploying user, and allow anonymous access. Copy the production URL ending in `/exec` into the Cloudflare Worker variable `GOOGLE_APPS_SCRIPT_URL`. Store the same secret in the Worker secret `GOOGLE_APPS_SCRIPT_SECRET`.

The script sends only to `steff@joycafe28.com`, uses the customer's validated address only as Reply-To, and returns no personal data to Cloudflare.
