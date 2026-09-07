# HomeownersOfTexas.org

A public-interest Texas homeowner data and rights site built as a zero-dependency static application. Government data snapshots are refreshed by GitHub Actions and the generated site is served by Cloudflare Workers Static Assets.

## Architecture

- `data/static/issues.json` — curated issue-to-agency routing rules.
- `data/generated/statewide.json` — refreshed TDI / Texas Open Data metrics.
- `data/generated/legislation.json` — filtered Texas Legislature RSS items.
- `scripts/refresh-data.mjs` — resilient data ingestion. Keeps last-good values when a source fails.
- `scripts/build.mjs` — zero-dependency static generator.
- `site/` — generated deployable output.
- `.github/workflows/refresh-data.yml` — runs every 6 hours, updates snapshots, rebuilds, commits changes.
- `.github/workflows/deploy.yml` — deploys each `main` push to Cloudflare.

## First deployment

1. Upload this repository to GitHub with `main` as the production branch.
2. In GitHub repository settings, add Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. The Cloudflare token needs Workers Scripts / Workers Assets permissions sufficient for Wrangler deployment.
4. Run **Deploy to Cloudflare** once from GitHub Actions.
5. In Cloudflare, attach `homeownersoftexas.org` and `www.homeownersoftexas.org` as custom domains/routes for the `homeowners-of-texas` Worker.
6. Run **Refresh public data** once to verify source connectivity.

No API keys are required for the current public feeds. Socrata can optionally be given an app token later if request volume grows.

## Local preview

```bash
npm run build
npm run dev
```

Then open `http://localhost:8788`.

## Data-source philosophy

Official source -> normalized snapshot -> deterministic page facts -> optional explanatory layer.

The refresh script records source health and never replaces a last-good numeric value with an error or blank result.

## Important editorial rule

HomeownersOfTexas.org is an independent resource and is not affiliated with the former Homeowners of Texas organization, any government agency, or any law firm. Keep that disclosure visible in the footer and About page.
