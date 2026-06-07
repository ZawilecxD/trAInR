---
date: 2026-05-30T12:00:00+00:00
source: Context7 MCP
context7_library_id: /websites/resend
context7_examples_id: /resend/resend-examples
related_change: client-onboarding
tags: [resend, email, smtp, astro, supabase, s-03, client-onboarding]
status: reference
last_updated: 2026-05-30
---

# Resend documentation (client-onboarding)

Reference notes fetched via **Context7 MCP** (`/websites/resend`, `/resend/resend-examples`) for implementing email around [client-onboarding](./research.md). See [research.md](./research.md) for flow decisions (copy link MVP vs post-MVP send).

## How Resend fits client-onboarding

| Concern | S-03 MVP? | Resend usage |
|---------|-----------|--------------|
| Trainer copies invite link | **Yes** | None — no Resend API route needed |
| Auth confirmation after signup | **Yes** (production) | **SMTP** in Supabase Dashboard |
| Trainer “Send email” from UI | **Post-MVP** | **Node SDK** in Astro server code |

Do not merge auth confirmation mail with trainer-initiated invite mail when planning — same provider (Resend) can serve both via **SMTP + API key**.

## Prerequisites

From [Resend Astro docs](https://resend.com/docs/send-with-astro):

1. Create a Resend API key → store as `RESEND_API_KEY` in Vercel and `.env` locally.
2. Verify your sending domain in Resend; use that domain in `from` in production (not `onboarding@resend.dev`).

## 1. Post-MVP: transactional invite emails (Astro + SDK)

**Install:** `npm install resend`

**Recommended surface:** Astro SSR on Vercel — `POST /api/invites/send` with `export const prerender = false`, or [Astro Actions](https://docs.astro.build/en/guides/actions/) (official Resend guide pattern below).

Validate trainer session and role server-side before sending. Never call Resend from the browser.

### Official Astro Actions pattern (Context7)

```typescript
import { ActionError, defineAction } from 'astro:actions';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const server = {
  send: defineAction({
    accept: 'form',
    handler: async () => {
      const { data, error } = await resend.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: ['delivered@resend.dev'],
        subject: 'Hello world',
        html: '<strong>It works!</strong>',
      });

      if (error) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }

      return data;
    },
  }),
};
```

### trAInR API route pattern (from research)

```typescript
// src/pages/api/invites/send.ts (post-MVP)
import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  // validate session + trainer role, load invite URL
  const { data, error } = await resend.emails.send({
    from: "trAInR <invites@yourdomain.com>",
    to: clientEmail,
    subject: `${trainerName} invited you to trAInR`,
    html: `…`, // or React Email component
  });
  // return JSON error/success on error
};
```

### SDK usage (Node / TypeScript)

Always destructure `{ data, error }` from `resend.emails.send` and handle `error` before treating send as success:

```typescript
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "Acme <onboarding@resend.dev>",
  to: ["delivered@resend.dev"],
  subject: "Hello",
  html: "<p>Hello World</p>",
});

if (error) {
  // return 400/500 or throw ActionError
}
```

Optional: React Email templates via `react` property on send options (see `/resend/resend-examples`).

## 2. MVP production path: Supabase Auth SMTP

Covers **“confirm your email”** after client signup — not trainer invite delivery.

Configure in **Supabase → Authentication → Email → SMTP Settings** ([Resend + Supabase guide](https://resend.com/docs/send-with-supabase-smtp)):

| Field | Value |
|-------|--------|
| SMTP host | `smtp.resend.com` |
| Port | `587` (TLS) or `465` (SSL) |
| Username | `resend` |
| Password | Resend API key |
| Sender email / name | Verified address on your domain |

After switching off Supabase default SMTP, raise the default **30 emails/hour** auth rate limit.

Laravel/Django examples in Resend docs also document `smtp.resend.com`, user `resend`, password = API key — same credentials for any SMTP client.

## 3. Implementation checklist

**S-03 MVP (no Resend API route):**

- [ ] Copy-link UX on trainer surface
- [ ] (Production) Resend SMTP in Supabase for auth confirmations

**Post-MVP “Send invite”:**

- [ ] `RESEND_API_KEY` on Vercel
- [ ] Domain verified in Resend
- [ ] `POST /api/invites/send` (or Astro Action) with trainer auth
- [ ] Keep auth SMTP and transactional API as separate concerns

## External links

- [Send with Astro](https://resend.com/docs/send-with-astro)
- [Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## Context7 sources

| Library ID | Use |
|------------|-----|
| `/websites/resend` | Astro send, SMTP/Supabase, prerequisites |
| `/resend/resend-examples` | Node/TypeScript patterns, error handling, React Email |
