# TAJ Forms

TAJ Forms is an independent form-builder product in this repository. Its React web app, SvelteKit admin panel, Express API, MongoDB collections, authentication sessions, and deploy configuration are separate from the portfolio and existing Svelte admin application.

The app is a beta with no payment flow. Public signup is configurable from the admin panel. Current defaults cap accounts at 20 active forms and each form at 5,000 submissions; change these limits in the platform settings before opening the service more widely.

## Product

- Drag-and-drop form builder with autosave, preview, question ordering, and nine field types.
- Public forms with server-side answer validation, confirmation text, rate limits, a bot honeypot, and abuse reporting.
- Owner-scoped dashboard, paginated searchable response inbox, 30-day submission trends, choice-answer summaries, and formula-safe CSV export.
- Separate administrator sign-in with account suspension, form moderation, report review, platform limits, maintenance switch, and audit log API.
- Opaque HTTP-only session cookies, hashed server-side session and CSRF tokens, origin allowlist, password hashing, and isolated MongoDB database name `taj_forms`.

## Local development

Use Node.js 20 or newer and start a MongoDB instance before starting the API. In development, the API defaults to `mongodb://127.0.0.1:27017` and the isolated `taj_forms` database; set `MONGODB_URI` in `taj-forms/backend/.env` to use MongoDB Atlas. An Atlas connection string can point at the same cluster as the portfolio because TAJ Forms selects the separate `taj_forms` database. Production requires an explicit `MONGODB_URI`. Open three terminals from the repository root:

```powershell
if (-not (Test-Path taj-forms/backend/.env)) { Copy-Item taj-forms/backend/.env.example taj-forms/backend/.env }
if (-not (Test-Path taj-forms/frontend/.env)) { Copy-Item taj-forms/frontend/.env.example taj-forms/frontend/.env }
if (-not (Test-Path taj-forms/admin-panel/.env)) { Copy-Item taj-forms/admin-panel/.env.example taj-forms/admin-panel/.env }
```

Keep production credentials out of `.env.example` and Git. If MongoDB is not running locally, the API prints a setup hint and exits rather than starting without its database.

```powershell
cd taj-forms/backend
npm install
npm run dev
```

```powershell
cd taj-forms/frontend
npm install
npm run dev
```

```powershell
cd taj-forms/admin-panel
npm install
npm run dev
```

The public app is served at `http://localhost:5174/forms/`, the SvelteKit platform console at `http://localhost:5175/forms/`, and the API health check at `http://localhost:5010/forms/v1/health`.

Create the first administrator after configuring the API environment:

```powershell
cd taj-forms/backend
npm run admin:create
```

Set `ADMIN_BOOTSTRAP_EMAIL` and a strong `ADMIN_BOOTSTRAP_PASSWORD` of at least 16 characters in the local API environment first. The command creates a new admin account and deliberately refuses to promote an existing regular account.

## Checks

Run each app's checks from its directory:

```powershell
# API: build and unit tests
npm run build
npm test

# React app: typecheck, unit tests, and production build
npm run typecheck
npm test
npm run build

# Admin: Svelte/TypeScript diagnostics and production build
npm run check
npm run build
```

## Production deployment

Deployment is prepared but cannot go live until the hosting projects, MongoDB credentials, and Render URL exist. The repository's current domains already belong to the portfolio projects, so the new projects are mounted through narrow `/forms` rewrites and `/forms/v1` bridge. The aliases below are the intended Vercel project names; replace them in the existing rewrite files if Vercel assigns different aliases.

1. Create a dedicated MongoDB database/user for `taj_forms`; do not reuse portfolio application collections. Restrict network access to the API host.
2. Deploy `taj-forms/frontend` as the `taj-forms` Vercel project, with the root directory set to `taj-forms/frontend` and output directory `dist`.
3. Deploy `taj-forms/admin-panel` as the `taj-forms-admin` Vercel project, with root directory `taj-forms/admin-panel` and output directory `build`.
4. Deploy the blueprint at `taj-forms/backend/render.yaml` as the separate `taj-forms-api` Render service. Provide `MONGODB_URI` in Render's secret environment settings. Render supplies `PORT`.
5. On the existing portfolio Render API service, set `TAJ_FORMS_API_ORIGIN` to the new Forms API origin (for example `https://taj-forms-api.onrender.com`). This activates only the `/forms/v1` proxy route.
6. Configure the existing portfolio Vercel projects to route `/forms` to the public app and `admin.mdtaju.tech/forms` to the admin app, using their actual deployment URLs. The `frontend/vercel.json` and `admin-panel/vercel.json` files in this project provide each app's static SPA fallback and asset routing; the host-site rewrites belong in the existing portfolio projects.
7. Set `ALLOWED_ORIGINS` on the Forms API to the exact browser origins in use: `https://mdtaju.tech,https://admin.mdtaju.tech` (add preview origins only when needed). Set production `NODE_ENV=production`, a dedicated `MONGODB_URI`, `MONGODB_DB_NAME=taj_forms`, and the canonical app URLs.
8. Run `npm run admin:create` once in a controlled deployment shell with a separate administrator email and secret bootstrap password. Remove the bootstrap password variable after provisioning.
9. Verify `/forms/v1/health`, signup/login, create/edit/publish/submit/export, admin moderation, deep links, and browser cookie behavior on both domains.

The integration uses no shared portfolio models or sessions. The existing API bridge forwards the request body, allowlisted origin, cookie, CSRF header, and relevant response headers; it does not write Forms data into the existing portfolio database. Do not enable broad wildcard CORS or set a cookie `Domain` attribute.

## Deployment paths

- Public app: `https://mdtaju.tech/forms/`
- Form share URL: `https://mdtaju.tech/forms/f/<slug>`
- Admin panel: `https://admin.mdtaju.tech/forms/`
- API: `https://api.mdtaju.tech/forms/v1/`

These URLs become available after completing the hosting steps above; configuration in this repository does not itself publish a service or change DNS.
