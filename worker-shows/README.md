# worker-shows

Cloudflare Worker backing the Bog Factor shows archive. Serves `/api/shows`
publicly and `/api/admin/*` behind Cloudflare Access. Data lives in D1
(`bogfactor`); show images live in R2 (`bogfactor-show-images`).

## One-time Cloudflare setup

These need your Cloudflare login — run them yourself.

```bash
cd worker-shows
npx wrangler login

# 1. Create the D1 database. Copy the printed database_id into wrangler.toml.
npx wrangler d1 create bogfactor

# 2. Apply the schema.
npx wrangler d1 execute bogfactor --remote --file=schema.sql

# 3. Create the R2 bucket.
npx wrangler r2 bucket create bogfactor-show-images

# 4. Deploy the worker (routes are declared in wrangler.toml).
npx wrangler deploy
```

The routes in `wrangler.toml` send `bogfactor.co.uk/api/*` to this worker.
The existing Pages deployment continues to serve everything else, including
the new `admin/` page.

## Cloudflare Access (auth for /admin and /api/admin/\*)

In the dashboard: **Zero Trust → Access → Applications → Add an application →
Self-hosted**.

- Application domain: `bogfactor.co.uk/admin` (add a second app for
  `bogfactor.co.uk/api/admin`).
- Policy: `Allow` where `Emails` includes your address.
- Identity provider: One-time PIN is fine, or wire up Google.

Then copy the **Application Audience (AUD) tag** and your team domain (e.g.
`bogfactor.cloudflareaccess.com`) into `wrangler.toml` under `[vars]` as
`ACCESS_AUD` and `ACCESS_TEAM_DOMAIN`, and redeploy. The worker will then
verify the Access JWT on every admin request as defence-in-depth.

## Seeding from `radio/shows.json`

After the worker, D1, and R2 exist:

```bash
node tools/migrate-json-to-d1.mjs
npx wrangler d1 execute bogfactor --remote --file=tools/out/migration.sql
bash tools/out/upload-images.sh
```

The migration uses the first Friday of each show's `YYYY-MM` at 13:00 UTC for
`aired_at`. Hand-edit any one-offs (e.g. the morning shows) in the admin UI
afterwards.

## Local dev

```bash
cd worker-shows
npx wrangler dev --local
# Worker on http://127.0.0.1:8787

# In another terminal, from repo root:
python3 -m http.server 3000
```

To point the local site at the local worker, temporarily change
`fetch('/api/shows')` in `scripts/generate-show-list.js` to
`fetch('http://127.0.0.1:8787/api/shows')`.

Local Access JWT verification is bypassed when `ACCESS_TEAM_DOMAIN` /
`ACCESS_AUD` are empty (the worker logs a warning). Don't deploy with those
empty.

## Backups

```bash
npx wrangler d1 export bogfactor --remote --output=backup-$(date +%F).sql
```
