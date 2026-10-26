# green-tracker
Mobile-first web app for tracking and rating cannabis products — ratings, purchase history, photos and a personal leaderboard, with accounts and approval-based following. Built on Cloudflare Workers, D1 and R2.

Live: https://green-tracker.green-tracker.workers.dev — on iPhone, open it in Safari, then Share → View More → Add to Home Screen (on iOS 26, tap ⋯ first to find Share).

`SPEC.md` is the living spec: what's built, every decision, and the changelog.

## Develop

```sh
npm ci
cp .dev.vars.example .dev.vars   # passkeys bind to localhost
npm run db:migrate:local
npm run dev
```

## Test

```sh
npm run typecheck
npm test            # domain + API (real Worker, fresh local D1/R2)
npm run test:e2e    # Playwright against the built app
```

## Remove background (the on-phone AI)

`client/public/ai/` holds the background-removal model (committed, ~47 MB in four parts), made by
`scripts/make-cutout-model.py`; its engine file is copied from `node_modules` before every build and dev
run (`scripts/copy-ai-engine.mjs`). See SPEC §4 *Remove background*.

## Deploy

Merging to `main` deploys automatically (GitHub Actions: tests → migrations → deploy → live check).
It needs the repository secret `CLOUDFLARE_API_TOKEN`. To deploy by hand: `CLOUDFLARE_API_TOKEN=… npm run deploy`.

## Website

`site/` is the website for people who haven't got the app yet (D63): plain files in `site/public/`, deployed as
their own Worker (`site/wrangler.jsonc`). CI deploys the preview from `dev` and the public site
(https://green-tracker-site.green-tracker.workers.dev) from `main`. Its tests are `test/e2e/website.spec.ts`. See SPEC
§4 *Website*.
