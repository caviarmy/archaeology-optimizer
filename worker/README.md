# Obelisk OCR worker (Cloudflare)

A tiny Cloudflare Worker that holds your Gemini API key. It serves two actions,
and the key never reaches the browser — the app only ever talks to your worker:

1. **OCR** — `{ "image": "data:..." }` turns a stats-panel screenshot into the
   structured JSON the optimizer fills its fields with.
2. **Diagnose** — `{ "action": "explain", "debug": { ... } }` takes a trimmed
   optimizer snapshot and returns `{ "explanation": "..." }`, a plain-language
   note on why the recommended build scored well. This action is capped at
   `EXPLAIN_DAILY_LIMIT` per IP/day (default 1) and `EXPLAIN_GLOBAL_LIMIT`
   total/day (default 200), so worst-case spend stays bounded. Cost is well
   under 1¢/call on a `*-flash-lite` model.

After changing this folder, redeploy with `wrangler deploy` for either feature
to pick up the change.

## What you need
- A Cloudflare account (free).
- A Google **Gemini API key** — create one at https://aistudio.google.com/app/apikey
  (free tier works; the worker defaults to `gemini-2.5-flash` for OCR).
- Node.js installed locally (for `wrangler`).

## Deploy (5 minutes)
```bash
cd worker
npm install -g wrangler        # if you don't have it
wrangler login                 # opens the browser, authorise once

# put your Gemini key in as a secret (paste when prompted):
wrangler secret put GEMINI_API_KEY

wrangler deploy                # prints your URL, e.g. https://obelisk-ocr.<you>.workers.dev
```
Copy that `*.workers.dev` URL.

## Point the app at it
In the optimizer: **Settings → Base stats & skills → AI OCR worker URL**, paste
the URL, and Confirm. Then import a screenshot as usual.

## Test the worker directly (optional)
```bash
# Tiny sanity check — should return a JSON error about a bad image, not a crash:
curl -X POST https://obelisk-ocr.<you>.workers.dev \
  -H 'Content-Type: application/json' -d '{"image":"data:image/png;base64,AAAA"}'
```

## Optional hardening
The worker proxies *your* free Gemini quota, and the app is public, so anyone who
finds the URL can spend your quota. Sensible options:

- **Per-IP daily cap** (recommended): create a KV namespace and bind it.
  ```bash
  wrangler kv namespace create RL
  ```
  Paste the printed `id` into the `[[kv_namespaces]]` block in `wrangler.toml`,
  uncomment it, then `wrangler deploy` again. Cap is `DAILY_LIMIT` (default 100/IP/day).
- **Origin lock**: set `ALLOWED_ORIGINS` in `wrangler.toml` to your Pages origin
  (e.g. `https://caviarmy.github.io`). Note CORS/Origin is only a soft guard.
- **Model**: OCR reads screenshots with `GEMINI_OCR_MODEL` (default `gemini-2.5-flash`, picked for accuracy on dense panels); the Diagnose text call uses the cheaper `GEMINI_MODEL` (default `gemini-2.5-flash-lite`). Change either in `wrangler.toml`.

## Notes
- Screenshots are sent to Google. On the free tier, inputs may be used to improve
  their models — fine for a game panel, but don't send anything sensitive.
- Free-tier rate/daily limits apply per key; heavy shared use can hit them.
