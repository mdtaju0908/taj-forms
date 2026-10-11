# Deployment and security runbook

## Service boundaries

| Service | Project root | Runtime | Public entry |
| --- | --- | --- | --- |
| TAJ Forms web | `taj-forms/frontend` | Vercel static SPA | `mdtaju.tech/forms` |
| TAJ Forms admin | `taj-forms/admin-panel` | Vercel static SPA | `admin.mdtaju.tech/forms` |
| TAJ Forms API | `taj-forms/backend` | Render Node service | `api.mdtaju.tech/forms/v1` |
| Portfolio API bridge | `backend` | Existing Render service | forwards only `/forms/v1` |

The React and Svelte sites each have their own Vercel project. Configure the existing portfolio Vercel projects to route the `/forms` paths to the deployed app URLs. The `vercel.json` files in this project configure static asset paths and SPA fallbacks; host-site rewrite destinations belong in the portfolio projects.

## API production environment

Required values:

- `NODE_ENV=production`
- `MONGODB_URI`: secret dedicated to TAJ Forms; do not point it at the portfolio service's database.
- `MONGODB_DB_NAME=taj_forms`
- `ALLOWED_ORIGINS=https://mdtaju.tech,https://admin.mdtaju.tech`
- `PUBLIC_APP_URL=https://mdtaju.tech/forms`
- `ADMIN_APP_URL=https://admin.mdtaju.tech/forms`

The platform bootstrap command additionally needs `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` while provisioning. Use a unique email and a strong password, then remove the bootstrap password value. The initial admin role is not granted through public signup.

## Existing API proxy

Set `TAJ_FORMS_API_ORIGIN` on the existing portfolio API service to the Forms Render origin, without a path or trailing slash. Example: `https://taj-forms-api.onrender.com`. The bridge forwards only `/forms/v1/*`, passes through the original browser origin and Forms session cookie, and returns JSON or CSV data. Without this variable the route returns `503`; all existing `/api/*` routes continue to use their existing handlers.

## Smoke checks after deploy

1. Open `https://api.mdtaju.tech/forms/v1/health`; confirm `database: connected`.
2. Open `/forms/`, create a test account, create a form with a required email and choice field, publish, and submit valid/invalid values.
3. Confirm choice values display as labels in responses and CSV fields beginning with `=`, `+`, `-`, or `@` are neutralized.
4. Sign in to `/forms/` on the admin domain; confirm a regular member receives no admin access.
5. Suspend a test account, archive a test form, resolve a test abuse report, and confirm the audit API records actions.
6. Test 320, 390, 768, and 1440 CSS pixel widths; check keyboard-only form completion and reduced-motion mode.

Do not claim the production routes are live until the Vercel targets, Render origin, MongoDB credentials, and host environment values have been installed and smoke checked.
