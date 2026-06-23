# Report Tool

Internal FE team reporting tool built with Next.js, Ant Design, and Supabase.

## Environment Variables

Create `.env.local` for local development and configure the same variables on Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ENCRYPTION_KEY=
```

`ENCRYPTION_KEY` is server-only and is used to encrypt report fields before saving to Supabase. Do not prefix it with `NEXT_PUBLIC_`.

Generate a key with:

```bash
openssl rand -base64 32
```

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm lint
pnpm build
```

## Supabase

Run SQL files in order for a fresh setup:

```text
supabase/phase1.sql
supabase/phase2.sql
supabase/phase3.sql
supabase/phase4.sql
supabase/phase5-notifications.sql
```

Optional data helpers:

```text
supabase/add-team-members.sql
supabase/cleanup-demo-data.sql
```
