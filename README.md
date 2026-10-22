# RMIT_CTY_GVAR_C2
RMIT Hackathon - Industry Challenge 2
[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

**NDIS Claim Chain** is a disability support claims workflow where a claim is only payable once the participant, the support worker, the provider and an agency approver have each signed their own step, and any edit to a signed step after the fact is detected and refused.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

Today an NDIS claim is a record in somebody's system. A provider enters it, and everyone downstream trusts that whoever entered it got it right. The participant, the person the service was actually for, usually has no direct say in whether it happened as claimed.

NDIS Claim Chain changes what a claim *is*. It is no longer one trusted record but a sequence of **signed statements**, each made by the person who knows that part to be true:

| Step | Who signs | What they are saying |
|---|---|---|
| 1. Service delivered | Support worker | "I delivered 2 hours of community access to this participant on this date." |
| 2. Service confirmed | Participant (or their nominee) | "Yes, this happened, and I agree to it being claimed." |
| 3. Claim submitted | Provider | "This matches our service agreement and the participant's plan." |
| 4. Claim approved | Agency approver | "This passes the funding rules and is approved for payment." |

Each statement also includes a fingerprint of the step before it, so the chain's order is part of what gets signed. Steps can't be reordered, skipped or swapped later.

What makes this distinctive is where the signatures come from. They are not produced by our server, and not by a key any one organisation holds. They are produced by the Tide network on behalf of the logged-in person, after the network itself checks that the person is who the statement says made it. Our own server cannot forge a step.

### 2. Trust constraint insight

Disability support payments involve several parties who have good reason not to fully trust each other's records, and one person, the participant, whose most sensitive information flows through all of them.

That creates three problems:

- **Whoever controls the database controls the truth.** A provider admin, a plan manager or an attacker with database access can change hours, dates or service types, and nothing in the record shows it.
- **Participants are bystanders to their own claims.** Confirming a service is usually informal or after the fact, so there is little to stop a service being claimed that never happened.
- **Sensitive plan data is visible to whoever runs the system.** Diagnoses, support needs and funding details sit in a central store that administrators can read.

Because no one can trust a single record, the system fills up with manual checks, audits and delays, and honest providers wait longer to get paid.

When the constraint is removed:

- **A claim is valid only while its signatures verify.** If anyone edits a signed step in the database, including an administrator, it no longer matches its signature and the claim is refused.
- **The participant's confirmation is required, and only the participant can give it.** Nobody else, not the provider and not an admin, can sign on the participant's behalf.
- **No single person can make a claim payable.** Payment needs four signatures from four *different* people. One person holding two roles can't fill two steps.
- **Private details stay encrypted.** Each role can open only the records it is entitled to, and our server never sees the plaintext.

### 3. Value & impact

- **Participants** get a real, simple voice: a "Yes, this happened" button on their phone. A service they didn't receive can't be paid without them.
- **Honest providers and workers** get paid faster. A claim carrying four verified signatures doesn't need the same manual chasing as an unverified record.
- **The agency** gets claims that are tamper-evident by construction, with an audit trail that names who said what. Fraud and error investigations start from evidence, not from "the database says".
- **Everyone** benefits from plan details being seen only by the people who need them.

**Example.** Mia's support worker logs a 3-hour community outing. Mia confirms it in the app. Later, someone with database access at the provider changes the record to 5 hours before it goes to the agency. Today, nothing catches that. In NDIS Claim Chain, the edited step no longer matches the signatures from Mia and her worker. The claim shows as **unverified**, payment is blocked, and the record points at exactly which step was changed.

### 4. Why TideCloak matters

TideCloak provides the identity, authority and privacy layer. Our app provides the claims logic.

**What TideCloak does**

- **Login and roles.** Participants, nominees, workers, providers and approvers sign in through TideCloak. The tokens that carry their roles are signed by the Tide network rather than by one server's key, and our API checks the role on every request before acting. Hiding a button is never treated as protection.
- **Signed steps (Tide attestations).** Each claim step is a statement the Tide network signs on the user's behalf. Before signing, the network checks that the logged-in person is the one the statement names as its author:
  - The participant's confirmation is a **"self"** statement. The network only signs it if the participant is signing about themselves, so no one can confirm on their behalf.
  - Worker, provider and approver steps are **"role"** statements. The network only signs them for someone who holds that role.
- **Participant-owned encrypted plan data (demo scope).** Plan text is encrypted in the participant's browser with a Tide tag unique to that participant. The database stores the ciphertext; only that participant is granted the matching decrypt role. Care-team sharing is not implemented yet, and record metadata (participant, category and update time) remains visible to the app server.
- **Governed permission changes.** With Tide's identity governance switched on, granting someone the approver role, or adding them to a care team, needs sign-off from a quorum of admins. Quorum is 70% of admins, rounded down, so we run three admins to make any change need two of them. A single rogue admin cannot make themselves an approver.

**What our app does**

- Builds each step's statement on the server from the claim data, sends it to the user's browser to sign, then **re-checks the returned signature before saving it**.
- Stores the claim data and its signatures, never the signed bytes themselves, so every check rebuilds the statement from the current data. Any edit breaks the match.
- Gates payment release: four valid signatures, in order, from four different people, plus funding rule checks (plan budget, service category, date range).
- Handles disputes and corrections by appending a new signed step. Nothing is ever edited in place.

**Honest limits we design around**

- Withdrawing a signature is a server action, not a signed one. Corrections and disputes are therefore new signed steps, not deletions.
- The network doesn't timestamp steps. Our server enforces dates and claim windows.
- Signing needs a logged-in person in a browser. Automated jobs can prepare claims but cannot sign them.
- The actual bank payment happens outside the system. The prototype ends at "approved for payment".

### 5. Prototype & storytelling

The prototype walks one claim through its full life, with each role played in its own browser window.

1. **The worker** logs a service and signs it.
2. **The participant** opens their claim on a phone and taps "Yes, this happened". Behind the scenes, the Tide network refuses to sign this step for anyone except the participant.
3. **The provider** submits and **the approver** approves, each signing their step. The claim shows four green checks and becomes payable.

**The moment to watch: the tamper test.** An admin edits the claim's hours directly in the database. On refresh, the claim turns red. The edited step no longer matches its signatures, payment is blocked, and the screen shows exactly which step was altered.

Two more refusals complete the story:

- **Signing on someone else's behalf.** The provider tries to confirm on the participant's behalf, and the Tide network refuses to sign it.
- **Self-promotion.** A single admin tries to make themselves an approver, and the change sits waiting for a second admin's approval.

**Prototype status.** Login, roles and governed admin changes run through TideCloak. The participant dashboard can save plan text encrypted in the browser; the demo realm grants the unique plan tag only to Mia. A fresh realm bootstrap provisions these roles. An existing realm needs the roles granted to Mia through its governed admin flow. Care-team plan sharing is not implemented. The signed claim steps currently use an interim server HMAC until Tide deploys the reviewed attestation contract.

**Next step after the prototype.** A version where payment release itself also requires a second agency approver to co-sign at the network level, rather than through our app's rule check. Tide supports this kind of multi-approver signing, but it is the least proven part of the platform today, so we kept it out of the core demo.

## Setup

The app is built as though TideCloak protects it. Sign-in, roles and access checks follow TideCloak's model but run inside the app, so there is no TideCloak server to set up. You only need a database and the web app.

**You need:** Docker Desktop (running) and Node.js 20.9 or later.

### 1. Start the database


```bash
docker run -d --name claimchain-db -e POSTGRES_USER=claimchain -e POSTGRES_PASSWORD=<db-password> \
  -e POSTGRES_DB=claimchain -p 5432:5432 postgres:16
docker exec -i claimchain-db psql -U claimchain -d claimchain < db/schema.sql
docker exec -i claimchain-db psql -U claimchain -d claimchain < db/seed.sql```

On Windows PowerShell, load the two files with `Get-Content db/schema.sql | docker exec -i claimchain-db psql -U claimchain -d claimchain` (and the same for `seed.sql`).

### 2. Configure

```bash
cd web
cp .env.example .env
```

In `web/.env`, set:

- `DATABASE_URL=postgresql://claimchain:<db-password>@localhost:5432/claimchain`
- `STEP_SIGNING_SECRET` and `TIDECLOAK_SIM_SECRET`: two different random strings. Make each with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### 4. Try it

Sign in with the accounts in [`DEMO-LOGINS.md`](DEMO-LOGINS.md). Use a separate private window for each person.

1. **sam.patel** (worker): log a service and sign it.
2. **jordan.lee** (provider): click **Confirm for the participant**. It is refused.
3. **mia.nguyen** (participant): click **Yes, this happened**.
4. **jordan.lee**: refresh and click **Submit and sign**.
5. **alex.romero** (approver): **Approve and sign**, then **Release payment**.
6. **admin**: on a claim that isn't paid yet, change the hours and save. The claim turns red and payment is blocked.