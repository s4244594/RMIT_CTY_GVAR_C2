# NDIS Claim Chain web app

Next.js app connected to the local TideCloak realm `claimchain`. Built on Tide's `nextjs-e2ee-vault` template.

## Run it

1. TideCloak running (Docker Desktop open, container `tidecloak`). The realm is set up by `../tidecloak/bootstrap.sh`.
2. `data/tidecloak.json` is the config exported from the realm. Copy it again from `../data/tidecloak.json` if you rebuild the realm.
3. Database: the `claimchain-db` PostgreSQL container, loaded with `../db/schema.sql` and `../db/seed.sql` (see the main README).
4. Copy `.env.example` to `.env` and set `DATABASE_URL` and `STEP_SIGNING_SECRET`.
5. `npm install`, then `npm run dev`, then open http://localhost:3000.

For local UI testing without Tide, keep `AUTH_MODE=simulated` and `NEXT_PUBLIC_AUTH_MODE=simulated` in `web/.env`. The plan editor then uses a development-only AES-GCM adapter with a random key in the current tab's `sessionStorage`. Use fictional data only; closing the tab removes the test key, so those test records can no longer be decrypted. This does not test Tide encryption or permissions and must never be enabled in production.

Next.js is pinned to 16.4.2 because its route-template check misreads `VAR_` in this project's filesystem path.
The `postinstall` patch preserves path replacements while Next expands its route templates; keep it in place when reinstalling dependencies.

## How it's put together

| Where | What |
|---|---|
| `src/app/dashboard/<role>/` | One dashboard per role: worker, participant, provider, approver, admin |
| `src/app/api/me/plan/route.ts` | Participant-only API for storing and retrieving encrypted plan records |
| `src/app/claims/[id]/` | Claim status and signature chain |
| `src/app/api/` | API routes. Every one goes through `withAuth`, which checks the Tide-signed token and its DPoP proof |
| `src/lib/caller.ts` | Who is calling. The role comes from the verified token, not the database |
| `src/lib/statement.ts` | What each step signs, rebuilt from the claim data on every check |
| `src/lib/people.ts` | Who may see whose name |
| `src/lib/useApi.ts` | Browser calls go through the SDK's `secureFetch`, which adds the DPoP proof |
| `src/lib/planRecords.ts` | Plan record categories, participant-specific Tide tags, and ciphertext serialization |
| `src/app/style.css` | All styling |

In live mode, plan text is encrypted and decrypted in the participant's browser using Tide's `doEncrypt`/`doDecrypt` APIs. In simulated mode, the UI uses the temporary local adapter described above. The API derives the participant-specific tag from the authenticated caller and never accepts a participant ID from the browser. In the demo realm, only Mia is provisioned with the matching Tide tag roles. For an existing realm, add the tag's `selfencrypt` and `selfdecrypt` roles and grant them only to Mia through Tide's governed admin flow; do not rerun bootstrap just to update roles. Care-team sharing is not part of this first version.

Files kept as the template shipped them: `next.config.ts`, `public/silent-check-sso.html`,
`public/tide_dpop_auth.html`, `src/app/auth/redirect/page.tsx`, `src/app/providers.tsx`, `src/lib/auth/*`.

## Interim: step signatures

Until Tide deploys the attestation contract, each step's signature is an HMAC made by this server
with `STEP_SIGNING_SECRET` (`contract_id = 'interim-hmac'`). It catches anyone who edits the database
without the server's secret. The Tide version moves signing to the Tide network, so the server can't
forge a step either.

## How it's put together

| Where | What |
|---|---|
| `src/app/dashboard/<role>/` | One dashboard per role: worker, participant, provider, approver, admin |
| `src/app/claims/[id]/` | Claim status and signature chain |
| `src/app/api/` | API routes. In live mode, `withAuth` checks the Tide-signed token and DPoP proof; in local simulation mode it checks a short-lived signed development cookie |
| `src/lib/caller.ts` | Who is calling. The role comes from the verified token, not the database |
| `src/lib/statement.ts` | What each step signs, rebuilt from the claim data on every check |
| `src/lib/people.ts` | Who may see whose name |
| `src/lib/useApi.ts` | Browser calls go through the SDK's `secureFetch`, which adds the DPoP proof |
| `src/app/style.css` | All styling |

Files kept as the template shipped them: `next.config.ts`, `public/silent-check-sso.html`,
`public/tide_dpop_auth.html`, `src/app/auth/redirect/page.tsx`.

## Interim: step signatures

Until Tide deploys the attestation contract, each step's signature is an HMAC made by this server
with `STEP_SIGNING_SECRET` (`contract_id = 'interim-hmac'`). It catches anyone who edits the database
without the server's secret. The Tide version moves signing to the Tide network, so the server can't
forge a step either.
