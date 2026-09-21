# Township Rollers FC Membership Portal

The Township Rollers FC supporter membership, club operations, and match-day portal.

## Production stack

- Next.js 16 and React 19
- Vercel hosting
- Neon Postgres for members, payments, fixtures, standings, players, and messages
- Vercel Blob for proof-of-payment uploads
- Auth.js with Google sign-in, plus administrator email/PIN access

## Local setup

1. Install Node.js 22 and pnpm.
2. Copy `.env.example` to `.env.local` and provide the required values.
3. Install packages with `pnpm install`.
4. Create the database tables with `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload token |
| `AUTH_SECRET` | Long random Auth.js signing secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXTAUTH_URL` | Public production URL, for example `https://popa.vercel.app` |

## Deploy to Vercel

1. Import `LukeMolly/popa` into Vercel as a Next.js project.
2. Create or connect a Neon Postgres database.
3. Create a Vercel Blob store.
4. Add the environment variables listed above for Production, Preview, and Development.
5. Run `pnpm db:migrate` once against the production database.
6. Deploy the `main` branch.
7. Add the final Vercel callback URL to the Google OAuth client:
   `https://YOUR-DOMAIN/api/auth/callback/google`.

The existing ChatGPT Sites deployment is separate and can remain online while the Vercel deployment is tested.
