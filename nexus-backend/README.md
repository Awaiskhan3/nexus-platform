# Nexus — Investor & Entrepreneur Platform

Lightweight monorepo with a Vite React frontend (`nexus-frontend`) and an Express + Socket.io + MongoDB backend (`nexus-backend`).

This README explains how to run locally and how to deploy the frontend and backend (Vercel + Render/Railway) using GitHub.

---

## Prerequisites
- Node.js (v18+)
- npm
- MongoDB Atlas cluster (or local MongoDB)
- GitHub account (for deployments)

---

## Quick local setup

1. Clone the repo and install dependencies

```bash
git clone <your-repo-url>
cd nexus

# Backend
cd nexus-backend
npm install
cp .env.example .env
# fill .env values (MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, etc.)
npm run dev

# Frontend (in a new terminal)
cd ../nexus-frontend
npm install
cp .env.example .env
# set VITE_API_URL=http://localhost:5000/api
npm run dev
```

Open the frontend at `http://localhost:5173` and the backend health at `http://localhost:5000/health`.

---

## Required environment variables (backend)
- `MONGODB_URI` — Atlas connection string (no angle brackets, password URL-encoded when needed)
- `JWT_SECRET` — long random string (access tokens)
- `JWT_REFRESH_SECRET` — long random string (refresh tokens)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` — for password reset emails
- `FRONTEND_URL` — production frontend URL (for CORS)

Notes:
- Never commit `.env` to GitHub. Use the hosting provider's environment settings.
- If you see `secretOrPrivateKey must have a value` it means `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing.

---

## Deployment (recommended)

We recommend: frontend → Vercel, backend → Railway.

Backend (Railway)
1. Push to GitHub.
2. On Railway: New Project → Deploy from GitHub → select repository.
3. Set Root Directory to `nexus-backend`.
4. Build command: `npm install`
5. Start command: `node src/server.js` (or `npm start`)
6. Add environment variables (see above). If you provisioned the database on Railway using their MongoDB plugin, use the provided connection string for `MONGODB_URI`.
7. Deploy and inspect service logs on first start. Railway provides a deployment log and environment editor in the project dashboard.

Frontend (Vercel)
1. In Vercel: New Project → Import GitHub repo.
2. Set the Project Root to `nexus-frontend`.
3. Build Command: `npm run build` — Output Directory: `dist`.
4. Add env vars:
   - `VITE_API_URL` = `https://<your-backend-host>/api`
   - `VITE_SOCKET_URL` = `https://<your-backend-host>`
5. Deploy.

Note: Railway can also host a static frontend if you prefer a single provider; ensure environment variables are configured in Railway for that service as well.

---

## Troubleshooting
- `querySrv ECONNREFUSED` / DNS SRV errors: allow outbound DNS or whitelist network; temporary fix: whitelist `0.0.0.0/0` in Atlas (dev only).
- `secretOrPrivateKey must have a value`: set `JWT_SECRET`/`JWT_REFRESH_SECRET` in hosting env.
- Authentication errors after changing secrets: users must re-login because old tokens are invalid.

---

## Useful commands
- Run backend dev: `npm run dev` (from `nexus-backend`)
- Run frontend dev: `npm run dev` (from `nexus-frontend`)
- Check backend health: `curl http://localhost:5000/health`

---
