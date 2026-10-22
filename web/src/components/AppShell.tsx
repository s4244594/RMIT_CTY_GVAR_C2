"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppAuth } from "@/lib/auth/appAuth";
import tideConfig from "../../data/tidecloak.json";
import { ProfileOnboarding } from "./ProfileOnboarding";
import { ROLES, roleOf } from "@/lib/roles";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    authenticated,
    isInitializing,
    isSimulated,
    username,
    login,
    logout,
    hasRealmRole,
    getValueFromToken,
    demoPickerOpen,
    closeDemoPicker,
    demoUsers,
    signInAs,
  } = useAppAuth();
  const pathname = usePathname();
  const role = authenticated ? roleOf(hasRealmRole) : null;
  const given = authenticated ? (getValueFromToken("given_name") as string | undefined) : undefined;
  const family = authenticated ? (getValueFromToken("family_name") as string | undefined) : undefined;
  const displayName = [given, family].filter(Boolean).join(" ") || "your account";

  const nav: [string, string][] = [["/", "Home"]];
  if (role) nav.push([ROLES[role].path, "My dashboard"]);

  return (
    <>
      <header>
        <div className="notice-bar">
          <div className="container">
            <span className="notice-tag">Prototype</span>
            <span>Hackathon concept for RMIT Industry Challenge 2. Not an official NDIS or NDIA service. All people and data are fictional.</span>
          </div>
        </div>
        <div className="site-header">
          <div className="container">
            <Link className="brand" href="/" aria-label="NDIS Claim Chain home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src="/ndis-logo.png" alt="NDIS" />
              <span className="brand-text">Claim Chain<small>Signed, shared claims</small></span>
            </Link>
            <div className="utility">
              {isInitializing ? null : authenticated ? (
                <>
                  <span className="whoami">
                    Signed in as <strong>{displayName}</strong>
                    {isSimulated && username ? <> ({username}, simulated)</> : null}
                    {role ? <> &middot; {ROLES[role].label}</> : null}
                  </span>
                  <button className="util-btn primary" onClick={() => void logout()}>Sign out</button>
                </>
              ) : (
                <button className="util-btn primary" onClick={() => login()}>Sign in</button>
              )}
            </div>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main">
          <div className="container">
            <ul>
              {nav.map(([href, text]) => (
                <li key={href}>
                  <Link href={href} aria-current={pathname === href ? "page" : undefined}>{text}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {isSimulated && (
        <div className="simulation-banner" role="status">
          DEVELOPMENT SIMULATION — TideCloak sign-in, identity proofing, and DPoP are not being used.
          Demo sessions are for local UI and role/access-check testing only.
        </div>
      )}

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container">
          <span>NDIS Claim Chain prototype &middot; built with TideCloak</span>
        </div>
      </footer>

      {demoPickerOpen && (
        <div className="simulation-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-login-title">
          <section className="panel simulation-picker">
            <button className="util-btn simulation-close" type="button" onClick={closeDemoPicker}>Close</button>
            <h2 id="demo-login-title">Choose a simulated demo role</h2>
            <p>This bypasses Tide sign-in and must only be used on your local development server.</p>
            {demoUsers.map((user) => (
              <button
                className="util-btn simulation-user"
                key={user.username}
                type="button"
                onClick={() => void signInAs(user.username).catch(() => undefined)}
              >
                {user.firstName} {user.lastName} ({user.username}) — {ROLES[user.role].label}
              </button>
            ))}
          </section>
        </div>
      )}

      {!isSimulated && (
        <ProfileOnboarding
          baseUrl={tideConfig["auth-server-url"].replace(/\/+$/, "")}
          realm={tideConfig.realm}
        />
      )}
    </>
  );
}
