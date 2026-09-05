FoundU — PRMSU BSCS 1B A.Y. 2025-2026

Single-server mode (recommended)
Only tested on Windows

1. Install
- `sqlite`
- `npm`

2. Install and run:
- `npm install`
- `npm run start`

3. Open the app directly from Express on port 3000:
- `http://127.0.0.1:3000/index.html`

4. API and frontend are served by the same server:
- `GET /api/items`
- `POST /api/items`
- other `/api/*` routes

## Admin auth setup (Google Sign-In)

1. Create the OAuth client (one time):
   - Go to https://console.cloud.google.com/apis/credentials
   - Create an **OAuth 2.0 Client ID** of type **Web application**.
   - Under **Authorized JavaScript origins** add every origin the login page
     will be opened from — exact match, no trailing slash:
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`
     - your tunnel / production URL, e.g. `https://nurtha.dev`
   - No redirect URIs are needed (this flow uses Google Identity Services only).

2. Configure the server:
   - `cp .env.example .env`
   - Put your client ID in `.env`:
     `GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com`
   - Optional but recommended: set `SESSION_SECRET` (any long random string).
   - Restart: `npm run start` — the server reads `.env` automatically
     (real environment variables win over `.env` if both exist).
   - If `GOOGLE_CLIENT_ID` is missing, the server logs a warning at startup
     and the login page will say Google auth is not configured.

3. Login and allowlist:
   - Login page: `http://127.0.0.1:3000/Login.html`
   - Any Google account can sign in, but only allowlisted emails are admins.
   - Allowlist file: `admin-allowlist.json` (`athrun.sison7@gmail.com` is the
     seeded super-admin).
   - Super-admin editor page: `http://127.0.0.1:3000/SuperAdmin.html`
     (super-admin accounts only).

4. Share publicly with one ngrok/cloudflare tunnel:
   - `ngrok http 3000` (or use `Start.sh` with cloudflared)
   - IMPORTANT: add the exact tunnel URL (e.g. `https://abc-xyz.trycloudflare.com`)
     to **Authorized JavaScript origins** in Google Cloud Console, or the
     Google button will fail with an origin error on that URL.

## Optional overrides

- Pages can point at a backend on another origin:
  `Login.html?apiBase=https://<your-backend-url>`
  The working base is remembered in `localStorage`, so `Admin.html` and
  `SuperAdmin.html` reuse the same origin automatically.
- If the frontend and API live on different sites, the server automatically
  issues `SameSite=None; Secure` session cookies over HTTPS so sign-in sticks.
- When running with `NODE_ENV=production`, set `CORS_ORIGINS` to the frontend
  origin(s), comma separated, e.g. `CORS_ORIGINS=https://nurtha.dev`.

## Troubleshooting Google login

| Symptom | Fix |
| --- | --- |
| "Google auth is not configured on the server" | Add `GOOGLE_CLIENT_ID` to `.env` and restart the server. |
| Google button missing / scripts failed | The `accounts.google.com/gsi/client` script was blocked — check ad blockers/VPN, then reload. |
| "The given origin is not allowed for the given client ID" (or button does nothing) | Add the exact origin shown in the address bar (e.g. `http://localhost:3000` or your tunnel URL) to **Authorized JavaScript origins** in Google Cloud Console. |
| Sign-in works but you bounce back to Login.html | Page and API are on different origins. Load the login page with `?apiBase=<backend-url>` and make sure both use HTTPS; check `CORS_ORIGINS` when `NODE_ENV=production`. |
| "not in the admin allowlist" | A super-admin must add your Google email in `SuperAdmin.html`, then reload the login page. |

## Notes

- Express logs startup as: `[server] Running at http://localhost:3000`
- Tests: `npm test` (set `TEST_GOOGLE_BYPASS=1` to include the auth-flow tests
  against a running server with `GOOGLE_AUTH_TEST_BYPASS=1`).
