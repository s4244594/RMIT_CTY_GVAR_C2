# NDIS Claim Chain web app

Next.js app connected to the local TideCloak realm `claimchain`. Built on Tide's `nextjs-e2ee-vault` template.

## Run it

1. TideCloak running (Docker Desktop open, container `tidecloak`). The realm is set up by `../tidecloak/bootstrap.sh`.
2. `data/tidecloak.json` is the config exported from the realm. Copy it again from `../data/tidecloak.json` if you rebuild the realm.
3. Database: the `claimchain-db` PostgreSQL container, loaded with `../db/schema.sql` and `../db/seed.sql` (see the main README).
4. Copy `.env.example` to `.env` and set `DATABASE_URL` and `STEP_SIGNING_SECRET`.
5. `npm install`, then `npm run dev`, then open http://localhost:3000.

## How it's put together

| Where | What |
|---|---|
| `src/app/dashboard/<role>/` | One dashboard per role: worker, participant, provider, approver, admin |
| `src/app/claims/[id]/` | Claim status and signature chain |
| `src/app/api/` | API routes. Every one goes through `withAuth`, which checks the Tide-signed token and its DPoP proof |
| `src/lib/caller.ts` | Who is calling. The role comes from the verified token, not the database |
| `src/lib/statement.ts` | What each step signs, rebuilt from the claim data on every check |
| `src/lib/people.ts` | Who may see whose name |
| `src/lib/useApi.ts` | Browser calls go through the SDK's `secureFetch`, which adds the DPoP proof |
| `src/app/style.css` | All styling |

Files kept as the template shipped them: `next.config.ts`, `public/silent-check-sso.html`,
`public/tide_dpop_auth.html`, `src/app/auth/redirect/page.tsx`, `src/app/providers.tsx`, `src/lib/auth/*`.

## Interim: step signatures

Until Tide deploys the attestation contract, each step's signature is an HMAC made by this server
with `STEP_SIGNING_SECRET` (`contract_id = 'interim-hmac'`). It catches anyone who edits the database
without the server's secret. The Tide version moves signing to the Tide network, so the server can't
forge a step either.
