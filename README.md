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


## WhatsApp production setup

Outbound sending is fail-closed. If `DISABLE_OUTBOUND` is missing, the app behaves as if it were `true` and accepts webhooks without sending replies. Production must set all of these environment variables for the Functions scope and Production context:

- `DISABLE_OUTBOUND=false` - required to send any reaction, typing indicator, reply, or notification.
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`

After adding or changing a variable in Netlify, trigger a new production deploy. Test with `שלום`, then inspect `Logs & Metrics` > `Functions` > `whatsapp`. Each supported inbound message logs `whatsapp_inbound` with its message ID; the matching `whatsapp_outbound` entry records the reaction, typing, and final send outcome. A `reason` of `disable_outbound` or `not_configured` is a configuration blocker, not a successful reply.
