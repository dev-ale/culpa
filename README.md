# Culpa

A web app for tracking debts within a small group of people. One **Creator** (authenticated) manages entries; other **Viewers** access the group through a shared link in read-only mode.

> 📄 Full product spec: [docs/PRD.md](./docs/PRD.md) · Domain glossary: [CONTEXT.md](./CONTEXT.md) · Key decision: [ADR-0001](./docs/adr/0001-unified-entry-no-debt-entity.md)

## How it works

- A **Creator** signs in (Supabase magic link), creates a **Group** with a fixed currency, and adds **Participants** (named people, no accounts).
- Every transaction is an **Entry** — either an **Expense** (someone fronted a cost, split into **Shares**) or a **Payment** (one person paid another to even up). Both share the same schema.
- **Pairwise balances** ("Bob owes Alex €10") are *derived on read* from Shares — there is no stored debt table.
- A **Viewer** opens the share link, picks "who am I?" from the participant list (stored in `localStorage` for personalization), and sees the same data read-only. Viewers poll every 30s while the tab is focused; no realtime in v1.

Settling up is just recording a Payment Entry from debtor to creditor — there is no "mark as paid" toggle. See the [PRD](./docs/PRD.md) for the complete model, RLS rules, and v1 non-goals.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI | [shadcn/ui](https://ui.shadcn.com) (Radix UI + Base UI primitives), lucide-react icons |
| Auth & DB | [Supabase](https://supabase.com) — Auth (magic link) + Postgres, via [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side) |
| ORM / migrations | [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit |
| Validation | [Zod](https://zod.dev) |

Supabase session refresh runs in `proxy.ts` (Next.js 16's renamed middleware), backed by `lib/supabase/middleware.ts`.

## Getting started

Requires [pnpm](https://pnpm.io) and a [Supabase](https://supabase.com) project.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm db:push                 # apply the Drizzle schema to your database
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string |

For `DATABASE_URL`, use the **Transaction** pooler URL (port 6543) for the app runtime; use the **Session** pooler or direct connection (port 5432) for `drizzle-kit` migrations.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate a migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push the schema directly (dev convenience) |
| `pnpm db:studio` | Open Drizzle Studio |

## Project structure

```
app/                  Next.js App Router (routes, layout, global styles)
components/           UI components (shadcn/ui)
lib/
  supabase/           Browser, server, and middleware Supabase clients
  db/                 Drizzle schema and client
docs/                 PRD and ADRs
proxy.ts              Session-refresh middleware
drizzle.config.ts     Drizzle Kit configuration
```

## Deployment

Built to deploy on [Vercel](https://vercel.com). Set the three environment variables above in the project, then connect the repo. See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
