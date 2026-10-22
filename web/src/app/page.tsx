"use client";

import Link from "next/link";
import { useTideCloak } from "@tidecloak/nextjs";
import { ROLES, roleOf } from "@/lib/roles";

export default function HomePage() {
  const { authenticated, isInitializing, login, hasRealmRole } = useTideCloak();
  const role = authenticated ? roleOf(hasRealmRole) : null;

  return (
    <>
      <section className="hero">
        <div className="container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-logo" src="/ndis-logo.png" alt="NDIS" />
          <h1 style={{ marginTop: 24 }}>Claim Chain</h1>
          <p>Support claims signed step by step by the people who know they happened, including the participant.</p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            {isInitializing ? null : role ? (
              <Link className="btn btn-light" href={ROLES[role].path}>Go to my dashboard</Link>
            ) : authenticated ? (
              <span>Your account has no Claim Chain role yet. Ask an administrator to add one.</span>
            ) : (
              <button className="btn btn-light" onClick={() => login()}>Sign in</button>
            )}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true"><span className="p1" /><span className="p2" /><span className="p3" /></div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">How a claim gets paid</h2>
          <div className="steps">
            <div className="step"><h3>Worker signs</h3><p>&ldquo;I delivered this support.&rdquo;</p></div>
            <div className="step"><h3>Participant confirms</h3><p>&ldquo;Yes, this happened.&rdquo; Only the participant can sign this.</p></div>
            <div className="step"><h3>Provider submits</h3><p>&ldquo;This matches the service agreement.&rdquo;</p></div>
            <div className="step"><h3>Agency approves</h3><p>&ldquo;This passes the funding rules.&rdquo;</p></div>
          </div>
          <div className="panel">
            <h3>Why you can trust it</h3>
            <p style={{ margin: 0 }}>
              Everyone signs in through TideCloak, where passwords are checked by the Tide network and never stored.
              Each step is signed as the person who made it. If anyone changes a signed claim afterwards, even a
              system administrator, the signatures stop matching and payment is blocked. Names are only shown to
              people who work together.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
