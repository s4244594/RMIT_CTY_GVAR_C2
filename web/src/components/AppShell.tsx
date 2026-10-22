"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTideCloak } from "@tidecloak/nextjs";
import tcConfig from "../../data/tidecloak.json";
import { ProfileOnboarding } from "./ProfileOnboarding";
import { ROLES, roleOf } from "@/lib/roles";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, isInitializing, login, logout, hasRealmRole, getValueFromToken } = useTideCloak();
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
                    {role ? <> &middot; {ROLES[role].label}</> : null}
                  </span>
                  <button className="util-btn primary" onClick={() => logout()}>Sign out</button>
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

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container">
          <span>NDIS Claim Chain prototype &middot; built with TideCloak</span>
        </div>
      </footer>

      <ProfileOnboarding baseUrl={tcConfig["auth-server-url"].replace(/\/+$/, "")} realm={tcConfig.realm} />
    </>
  );
}
