# GitHub + Cloudflare setup

## GitHub

Upload the repository with `main` as the production branch. Add two Actions secrets under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare token should be scoped to the target account and have Worker deployment permissions. Do not commit the token.

Run **Deploy to Cloudflare** once. The workflow executes `npm run build` and `npx wrangler@4 deploy`.

Run **Refresh public data** once. It should update source-health records, rebuild the site, commit the new snapshots, and deploy the refreshed build. It then repeats every six hours.

## Cloudflare

The Wrangler project name is `homeowners-of-texas`, and the deployable asset directory is `site/`. This uses Workers Static Assets, not the deprecated Workers Sites system.

After the first deployment:

1. Open the `homeowners-of-texas` Worker in Cloudflare.
2. Add `homeownersoftexas.org` as a Custom Domain.
3. Add `www.homeownersoftexas.org` as a Custom Domain if you want `www` to resolve too.
4. Prefer a Cloudflare Redirect Rule that 301-redirects `www.homeownersoftexas.org/*` to `https://homeownersoftexas.org/$1`. The generated pages already canonicalize to the apex domain.

## Data automations

The current scheduled ingestion reads:

- Texas Department of Insurance homeowners market overview
- TDI insurance complaint dataset on Texas Open Data (`jjc8-mxkg`)
- TDLR statewide license dataset (`7358-krk7`)
- Texas Legislature Online RSS feeds for House filings, Senate filings, and passed bills

The job preserves last-good values if a source fails.

## No secrets needed for current public data feeds

The government feeds used in this release are public. A Socrata application token can be added later if API volume becomes high, but the current script does not require one.
