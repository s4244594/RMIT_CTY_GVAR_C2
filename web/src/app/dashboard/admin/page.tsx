"use client";

import { useState } from "react";
import Link from "next/link";
import tcConfig from "../../../../data/tidecloak.json";
import { RoleGate } from "@/components/RoleGate";
import { Alert, PageHero, StatusBadge } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useApi } from "@/lib/useApi";
import { useClaims } from "@/lib/useClaims";

const consoleUrl = `${tcConfig["auth-server-url"].replace(/\/+$/, "")}/admin/${tcConfig.realm}/console/`;

function TamperRow({ claim, onDone }: { claim: ClaimView; onDone: () => void }) {
  const api = useApi();
  const [hours, setHours] = useState(String(claim.hours));
  const [msg, setMsg] = useState<{ cls: "ok" | "bad" | "wait"; title: string; text: React.ReactNode } | null>(null);

  async function save() {
    try {
      const { claim: after } = await api<{ claim: ClaimView }>(`/api/admin/claims/${encodeURIComponent(claim.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ hours: Number(hours) }),
      });
      const link = <Link href={`/claims/${encodeURIComponent(claim.id)}`}>See the claim &rarr;</Link>;
      if (after.steps.length === 0) setMsg({ cls: "wait", title: "Saved", text: "Nothing is signed yet, so there's nothing to break." });
      else if (after.tampered) setMsg({ cls: "bad", title: "Saved to the database, and the claim is now unverified.", text: <>The signed steps no longer match. {link}</> });
      else setMsg({ cls: "ok", title: "Saved, and the signatures match again.", text: <>The data is back to what everyone signed. {link}</> });
      onDone();
    } catch (e) {
      setMsg({ cls: "bad", title: "Not saved", text: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <li style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span><span className="mono">{claim.id}</span> <span className="muted">&middot; {claim.participant.label} &middot; {claim.worker.label}</span></span>
        <StatusBadge claim={claim} />
      </div>
      <div className="inline-form" style={{ marginTop: 10 }}>
        <div className="field" style={{ maxWidth: 160 }}>
          <label htmlFor={`h-${claim.id}`}>claims.hours</label>
          <input id={`h-${claim.id}`} type="number" min="0.25" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <button className="btn btn-danger" onClick={save}>Save to database</button>
      </div>
      {msg && <Alert cls={msg.cls} title={msg.title}>{msg.text}</Alert>}
    </li>
  );
}

function AdminDashboard() {
  const { claims, error, reload } = useClaims();
  return (
    <div className="container">
      <div className="two-col">
        <div className="panel">
          <span className="badge bad">Tamper test</span>
          <h2 style={{ marginTop: 12 }}>Edit a claim directly in the database</h2>
          <p>
            This stands in for someone with database access, like editing <span className="mono">claims.hours</span> in
            the database directly. The edit is saved, but every signed step is rebuilt from the data and checked,
            so the change is caught and payment is blocked. Change the hours back and the signatures match again.
          </p>
          {error && <Alert cls="bad" title="Couldn't load claims">{error}</Alert>}
          {claims && claims.length === 0 && <p className="empty">No claims yet.</p>}
          <ul className="claim-list">
            {(claims ?? []).map((c) => <TamperRow key={c.id} claim={c} onDone={reload} />)}
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>As an admin you see roles and references, not names.</p>
        </div>

        <aside className="panel">
          <span className="badge">Governance</span>
          <h2 style={{ marginTop: 12 }}>Role changes need approval</h2>
          <p>
            Granting someone a role, adding a user or changing the realm is held as a change request until enough
            admins approve it in TideCloak. The Tide network enforces this, not a setting in our app.
          </p>
          <a className="btn btn-outline" href={consoleUrl} target="_blank" rel="noreferrer">Open TideCloak change requests</a>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero title="Admin dashboard">Full database access, but no power to fake a signature or grant roles alone.</PageHero>
      <RoleGate role="sysadmin"><AdminDashboard /></RoleGate>
    </>
  );
}
