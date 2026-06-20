Single-server mode (recommended)
Only tested on Windows

1. Install
- sqlite
- npm
- ngrok (if you want to share to your friends)

2. Install and run:
- `npm install`
- `npm run start`

3. Open the app directly from Express on port 3000:
- `http://127.0.0.1:3000/index.html`

4. API and frontend are served by the same server:
- `GET /api/items`
- `POST /api/items`
- other `/api/*` routes

5. Share publicly with one ngrok tunnel:
- `ngrok http 3000`

Notes:
- Express logs startup as: `[server] Running at http://localhost:3000`
- Frontend pages use same-origin API calls when served from port 3000.
- Optional override still works: `?apiBase=https://<your-backend-url>`

