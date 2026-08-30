# Norr Web Application — Production Deployment Guide

This guide details how to deploy the Norr web application (`@norr/web`) to any standard static hosting platform (e.g. Vercel, Netlify, Cloudflare Pages, AWS S3/CloudFront).

---

## 1. Build & Runtime Specifications

| Setting | Value |
| :--- | :--- |
| **Framework** | Vite + React (SPA) |
| **Node Version** | Node.js `22.x` (or `20.x` LTS) |
| **Package Manager** | `pnpm` (v10+ or v9+) |
| **Root Directory** | `.` (repository root) or `apps/web` |
| **Install Command** | `pnpm install` |
| **Build Command** | `pnpm --filter @norr/web build` (or `pnpm -r build`) |
| **Output Directory** | `apps/web/dist` |

---

## 2. Environment Variables

Configure the following environment variables in your hosting dashboard:

| Variable | Required | Default / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| **`VITE_SOLANA_RPC_URL`** | Optional | `https://api.devnet.solana.com` | Target Solana RPC URL (Devnet / Mainnet) |
| **`VITE_INDEXER_URL`** | Optional | `http://127.0.0.1:8787` | Hosted `@norr/indexer` REST endpoint |

---

## 3. SPA Routing & Rewrites

Because Norr is a single-page application with 13 routes (e.g. `/desks`, `/raise/:sale`, `/private`), all client requests must rewrite to `/index.html`:

- **Vercel:** Handled automatically via Vite Framework Preset (native zero-configuration SPA routing).
- **Netlify / Cloudflare Pages:** Handled automatically via [`apps/web/public/_redirects`](apps/web/public/_redirects).
- **Nginx / Custom Server:**
  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```

---

## 4. Platform Deployment Steps

### Deploying to Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set **Framework Preset** to `Vite`.
3. Set **Root Directory** to `apps/web`.
4. Set **Build Command** to `pnpm build`.
5. Set **Output Directory** to `dist`.
6. Add environment variable `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`.
7. Click **Deploy**.

### Deploying to Netlify
1. Import repository on [Netlify](https://netlify.com).
2. Set **Base directory** to `apps/web`.
3. Set **Build command** to `pnpm build`.
4. Set **Publish directory** to `apps/web/dist`.
5. Click **Deploy Site**.

### Deploying to Cloudflare Pages
1. Connect Git repository in Cloudflare Pages dashboard.
2. Set **Build system** to Version 2.
3. Set **Build command** to `pnpm --filter @norr/web build`.
4. Set **Build output directory** to `apps/web/dist`.
5. Click **Save and Deploy**.

---

## 5. Post-Deployment Verification Checklist

- [ ] Open deployment URL (e.g. `https://your-domain.com`).
- [ ] Verify root route `/` loads the Feed with launches and stats.
- [ ] Navigate directly to `/desks` and `/private` (verifying SPA rewrites work on refresh).
- [ ] Connect a Solana browser wallet (Phantom / Solflare).
- [ ] Confirm Topbar indicates connected Solana Devnet cluster status.
- [ ] Inspect `/private` and confirm capability gate displays `BLOCKED` with no console errors.
