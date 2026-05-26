---
saved_at: "2026-05-26T05:56:31.673Z"
---

Here’s what was added and updated.

### Workspace script

`scripts/open-workspace.sh` (run via `npm run workspace`):

1. Opens Linear, Supabase, and Vercel in the browser  
2. Starts `npm run dev` in the background  
3. Waits until `http://localhost:4321` responds, then opens the app  
4. Keeps the dev server in the foreground until you press Ctrl+C  

Uses `xdg-open` on Linux and `open` on macOS.

### README

- Replaced Cloudflare Workers with **Vercel** (`@astrojs/vercel`)
- Added a **Related Services** table with your Vercel, Supabase, Linear, and GitHub links
- Removed `.dev.vars` / Wrangler / Cloudflare deploy steps
- Documented Vercel env vars, manual deploy, and CI deploy flow
- Renamed project to **trAInR** and fixed clone URL to `ZawilecxD/trAInR`

### Usage

```bash
npm run workspace
```

Or directly:

```bash
bash scripts/open-workspace.sh
```