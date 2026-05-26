# trAInR

![](./public/template.png)

A modern fitness coaching app built with Astro SSR, React islands, Supabase auth, and Vercel deployment.

## Tech Stack

- [Astro](https://astro.build/) v6 — SSR with server-first rendering
- [React](https://react.dev/) v19 — UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 — Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 — Utility-first CSS framework
- [Supabase](https://supabase.com/) — Authentication and backend-as-a-service
- [Vercel](https://vercel.com/) — Hosting and serverless deployment (`@astrojs/vercel` adapter)

## Related Services

| Service | Purpose | Link |
| ------- | ------- | ---- |
| **Vercel** | Production and preview deployments | [tr-a-in-r project](https://vercel.com/zawilecxd1/tr-a-in-r) |
| **Supabase** | Auth and database (cloud project) | [Dashboard](https://supabase.com/dashboard/project/ywcshfujgapoptdkdqtj) |
| **Linear** | MVP backlog and issues | [trainr-mvp project](https://linear.app/zawilecxd/project/trainr-mvp-5d6b10ab8d1e/issues) |
| **GitHub** | Source and CI | [ZawilecxD/trAInR](https://github.com/ZawilecxD/trAInR) |

Set `SUPABASE_URL` and `SUPABASE_KEY` in the [Vercel project Environment Variables](https://vercel.com/zawilecxd1/tr-a-in-r/settings/environment-variables) for Production and Preview. CI uses the same values from GitHub repository secrets when building and deploying.

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/ZawilecxD/trAInR.git
cd trAInR
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.env` file from the example:

```bash
cp .env.example .env
```

5. Run the development server:

```bash
npm run dev
```

The app runs at [http://localhost:4321](http://localhost:4321).

### Open everything at once

To start the dev server, open the local app, and open Linear, Supabase, and Vercel in your browser:

```bash
npm run open-workspace
```

## Available Scripts

- `npm run dev` — Start development server (default: http://localhost:4321)
- `npm run open-workspace` — Start dev server and open local app + project dashboards
- `npm run build` — Build for production (SSR output for Vercel)
- `npm run preview` — Preview production build locally
- `npm run lint` — Run ESLint with type-checked rules
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run format` — Run Prettier

## Project Structure

```md
.
├── src/
│   ├── layouts/       # Astro layouts
│   ├── pages/         # Astro pages
│   │   └── api/       # API endpoints
│   ├── components/    # UI components (Astro & React)
│   ├── lib/           # Supabase client, helpers, services
│   └── middleware.ts  # Auth and protected routes
├── supabase/          # Local Supabase config and migrations
└── public/            # Static assets
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

For the hosted trAInR project, use the [Supabase dashboard](https://supabase.com/dashboard/project/ywcshfujgapoptdkdqtj) and add these variables to your `.env`:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API   |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

Under **Authentication → URL Configuration**, set:

- **Site URL:** `http://localhost:4321` for local dev (and your Vercel production URL for prod)
- **Redirect URLs:** `http://localhost:4321/**` and your Vercel preview/production URLs

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Vercel](https://vercel.com/zawilecxd1/tr-a-in-r) using the `@astrojs/vercel` adapter (`output: "server"` in `astro.config.mjs`).

### Manual deploy

```bash
npm run build
npx vercel deploy --prod
```

Requires `vercel login` and a linked project. Set `SUPABASE_URL` and `SUPABASE_KEY` in the Vercel dashboard under **Settings → Environment Variables**.

### CI deploy

GitHub Actions (`.github/workflows/ci.yml`) runs lint and build on every push/PR to `master`, then:

- **PRs:** preview deployment via `vercel deploy --prebuilt`
- **master:** production deployment via `vercel deploy --prebuilt --prod`

Repository secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## CI

GitHub Actions runs `npm run lint` and `npm run build` on every push and PR to `master`. On success, Vercel preview (PR) or production (`master`) deploy runs automatically when secrets are configured.

## License

MIT
