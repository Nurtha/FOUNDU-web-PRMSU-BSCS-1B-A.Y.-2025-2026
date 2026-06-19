Single-server mode (recommended)
Only tested on Windows

1. Install and run:
- `npm install`
- `npm run start`

2. Open the app directly from Express on port 3000:
- `http://127.0.0.1:3000/index.html`
- `http://127.0.0.1:3000/Admin.html`
- `http://127.0.0.1:3000/Login.html`
- `http://127.0.0.1:3000/good-samaritan-board.html`

3. API and frontend are served by the same server:
- `GET /api/items`
- `POST /api/items`
- other `/api/*` routes

4. Share publicly with one ngrok tunnel:
- `ngrok http 3000`

Notes:
- Express logs startup as: `[server] Running at http://localhost:3000`
- Frontend pages use same-origin API calls when served from port 3000.
- Optional override still works: `?apiBase=https://<your-backend-url>`

Vercel deployment

1. Deploy the repo to Vercel as-is.
2. Set one of these env var pairs for a free SQLite-compatible remote database:
- `LIBSQL_URL` + `LIBSQL_AUTH_TOKEN`
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
3. Keep `sqlite3` for local development only. When remote DB env vars are present, the app switches to the remote client automatically.
4. Vercel uses `api/index.js` as the serverless entrypoint, while the HTML files in the repo root stay available as static pages.
5. If you already have local data in `foundu.db`, run `npm run migrate:db` after setting the remote DB env vars to copy it up.
