# GT Padel WhatsApp availability agent

Phase 1 answers free-form Hebrew questions about live court availability at GT Padel, Ganei Tikva. It never books.

- Live occupied intervals from Matchpointer's public PostgREST API on every question
- 15-minute cache for venue, courts, opening hours and pricing
- Three active outdoor padel courts only
- GPT-4o-mini intent parsing with a deterministic Hebrew fallback
- Official Meta Cloud API webhook with signature verification
- Netlify free-tier deployment

## Local

```sh
cp .env.example .env
npm test
netlify dev
```

Webhook: `/api/webhooks/whatsapp`. Keep `DISABLE_OUTBOUND=true` until Meta verification and a smoke test pass.

The Matchpointer anon key is public browser configuration, not a service-role credential. Availability is informational and can change before booking.

