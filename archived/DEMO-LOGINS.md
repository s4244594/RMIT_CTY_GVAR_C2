# Demo logins

This guide contains account names, roles, and dashboard URLs only. Do not add
passwords, Tide credentials, or account-link invitation URLs here. Tide manages
authentication; keep credentials in your password manager.

## Account and dashboard reference

| TideCloak realm username | Role | Dashboard |
| --- | --- | --- |
| `sam.patel` | Support worker (`worker`) | <http://localhost:3000/dashboard/worker> |
| `mia.nguyen` | Participant (`participant`) | <http://localhost:3000/dashboard/participant> |
| `jordan.lee` | Provider (`provider`) | <http://localhost:3000/dashboard/provider> |
| `alex.romero` | Agency approver (`approver`) | <http://localhost:3000/dashboard/approver> |
| `admin` | System admin (`sysadmin`) | <http://localhost:3000/dashboard/admin> |

The realm users and role mappings are already provisioned. The first four
accounts still need to be linked to their respective Tide identities before
those identities can sign in as the demo users.

## Link each demo account

1. As a realm administrator, generate a Tide account-link action for the
   existing demo username using the `link-tide-account-action` required action.
   The bootstrap script uses this action for `admin`; it does not generate links
   for the four demo accounts.
   reuse one identity for multiple demo roles.
3. In Tide's admin console, approve the pending user change request produced by
   account linking, if the realm queues one. Linking is not complete until the
   account's `tideUserKey` is present.
4. Repeat for `sam.patel`, `mia.nguyen`, `jordan.lee`, and `alex.romero`.

The screenshot of the realm's user list confirms the user records exist, but it
does not show whether each account has a `tideUserKey`, and it cannot show
passwords. Empty email fields are not a blocker: this app's Tide setup does not
require email.
## Run the demo

1. Start the app and services as described in [README.md](./README.md).
2. Use a separate browser profile for each Tide identity, or sign out fully
   before switching accounts. Separate tabs in the same profile usually share
   the same Tide session.
3. Open <http://localhost:3000>, choose **Sign in**, and authenticate with that
   user's Tide identity.
4. Open <http://localhost:3000/dashboard>. The app redirects to the dashboard
   for the role in the verified Tide token. Confirm the role shown in the
   header matches the account you intended to test.

If `/dashboard` reports that the account has no Claim Chain role, check the
realm role mapping and the role claim in that user's Tide token. Do not work
around this by changing client-side state or sharing an identity; the API also
checks roles from the verified token.
