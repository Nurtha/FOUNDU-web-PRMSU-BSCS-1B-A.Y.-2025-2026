Single-server mode (recommended)
Only tested on Windows

1. Install
- `sqlite`
- `npm`
- `ngrok` (if you want to share to your friends)

2. Install and run:
- `npm install`
- `npm run start`

3. Open the app directly from Express on port 3000:
- `http://127.0.0.1:3000/index.html`

4. API and frontend are served by the same server:
- `GET /api/items`
- `POST /api/items`
- other `/api/*` routes

Admin auth setup (Google):
- Create a Google OAuth Web Client and set `GOOGLE_CLIENT_ID` in your environment.
- Optional but recommended: set `SESSION_SECRET` for stronger session token derivation.
- Admin allowlist is stored in `/home/runner/work/FOUNDU-web-PRMSU-BSCS-1B-A.Y.-2025-2026/FOUNDU-web-PRMSU-BSCS-1B-A.Y.-2025-2026/admin-allowlist.json`.
- Login page: `http://127.0.0.1:3000/Login.html`
- Super-admin allowlist editor page: `http://127.0.0.1:3000/SuperAdmin.html` (only super-admin accounts can access).

Behavior:
- Any Google user can sign in.
- Only emails in `admins` (or `superAdmins`) can access `/api/admin/*` and `Admin.html`.
- `athrun.sison7@gmail.com` is seeded as the default super-admin.

5. Share publicly with one ngrok tunnel:
- `ngrok http 3000`

Notes:
- Express logs startup as: `[server] Running at http://localhost:3000`
- Frontend pages use same-origin API calls when served from port 3000.
- Optional override still works: `?apiBase=https://<your-backend-url>`
