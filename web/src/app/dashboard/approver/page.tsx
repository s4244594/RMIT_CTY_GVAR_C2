"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";
import { Alert, Checks, ClaimFacts, ClaimList, money, PageHero, SignatureChain, StatusBanner } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useApi } from "@/lib/useApi";
import { useClaims } from "@/lib/useClaims";

function ReviewCard({ claim, onDone }: { claim: ClaimView; onDone: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cls: "ok" | "bad"; title: string; text: string } | null>(null);
  const allOk = claim.checks.every((c) => c.ok);
  const approved = claim.steps.some((s) => s.step === "approved");

  async function run(action: "approve" | "release") {
    setBusy(true);
    try {
      if (action === "approve") {
        await api(`/api/claims/${encodeURIComponent(claim.id)}/steps`, { method: "POST", body: JSON.stringify({ step: "approved" }) });
        setResult({ cls: "ok", title: "Claim approved and signed.", text: "All four steps are signed. You can now release payment." });
      } else {
        await api(`/api/claims/${encodeURIComponent(claim.id)}/release`, { method: "POST" });
        setResult({ cls: "ok", title: "Payment released", text: `${money(claim.amount)} released to ${claim.providerOrg}.` });
      }
      onDone();
    } catch (e) {
      setResult({ cls: "bad", title: "Refused", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2><Link href={`/claims/${encodeURIComponent(claim.id)}`} className="mono">{claim.id}</Link></h2>
      <StatusBanner claim={claim} />
      <div className="two-col" style={{ marginTop: 20 }}>
        <div>
          <h3>Funding rule checks</h3>
          <Checks claim={claim} />
          <div className="btn-row">
            <button className="btn" disabled={busy || approved || !allOk} onClick={() => run("approve")}>Approve and sign</button>
            <button className="btn btn-green" disabled={busy || !approved || claim.paid || claim.tampered} onClick={() => run("release")}>Release payment</button>
          </div>
          {result && <Alert cls={result.cls} title={result.title}>{result.text}</Alert>}
        </div>
        <ClaimFacts claim={claim} />
      </div>
      <h3 style={{ marginTop: 24 }}>Signature chain</h3>
      <SignatureChain claim={claim} />
    </div>
  );
}

function ApproverDashboard() {
  const { claims, error, reload } = useClaims();
  const open = (claims ?? []).filter((c) => !c.paid && !c.disputed && (c.nextStep === "approved" || c.nextStep === null));

  return (
    <div className="container">
      {error && <Alert cls="bad" title="Couldn't load claims">{error}</Alert>}
      {claims && open.length === 0 && <div className="panel"><p className="empty">No claims waiting for approval or payment.</p></div>}
      {open.map((c) => <ReviewCard key={c.id} claim={c} onDone={reload} />)}
      <div className="panel">
        <h2>All submitted claims</h2>
        {claims ? <ClaimList claims={claims} empty="No submitted claims yet." /> : <p className="empty">Loading…</p>}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero title="Agency approver dashboard">Check the funding rules, approve, and release payment (step 4 of 4).</PageHero>
      <RoleGate role="approver"><ApproverDashboard /></RoleGate>
    </>
  );
}
