"use client";

import Link from "next/link";
import { useTideCloak } from "@tidecloak/nextjs";
import { ROLES, roleOf, type RoleKey } from "@/lib/roles";

/**
 * Shows a page only to the right role. This is for the user's convenience: it decides what to
 * show, not what is allowed. Every API route checks the role again from the verified token.
 */
export function RoleGate({ role, children }: { role: RoleKey | "any"; children: React.ReactNode }) {
  const { isInitializing, authenticated, login, hasRealmRole } = useTideCloak();

  if (isInitializing) return <div className="container loading">Loading…</div>;

  if (!authenticated) {
    return (
      <div className="container">
        <div className="panel gate">
          <h2>Please sign in</h2>
          <p className="lead center">You sign in through TideCloak. Your password is checked by the Tide network and never stored.</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn" onClick={() => login()}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  const mine = roleOf(hasRealmRole);
  if (role !== "any" && mine !== role) {
    return (
      <div className="container">
        <div className="panel gate">
          <h2>You don&apos;t have access to this page</h2>
          <p className="lead center">
            This dashboard is for the {ROLES[role].label.toLowerCase()}.
            {mine ? ` You're signed in as a ${ROLES[mine].label.toLowerCase()}, and each account has one role.` : " Your account has no Claim Chain role yet."}
          </p>
          {mine && (
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link className="btn" href={ROLES[mine].path}>Go to my dashboard</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
