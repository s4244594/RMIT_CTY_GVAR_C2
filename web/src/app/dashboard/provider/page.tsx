"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";
import { Alert, Checks, ClaimFacts, ClaimList, PageHero } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useApi } from "@/lib/useApi";
import { useClaims } from "@/lib/useClaims";

function SubmitCard({ claim, onDone }: { claim: ClaimView; onDone: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cls: "ok" | "bad"; title: string; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/claims/${encodeURIComponent(claim.id)}/steps`, { method: "POST", body: JSON.stringify({ step: "submitted" }) });
      setResult({ cls: "ok", title: "Claim submitted and signed.", text: "The agency approver has been notified." });
      onDone();
    } catch (e) {
      setResult({ cls: "bad", title: "Not submitted", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Ready to submit: <Link href={`/claims/${encodeURIComponent(claim.id)}`} className="mono">{claim.id}</Link></h2>
      <div className="two-col">
        <ClaimFacts claim={claim} />
        <div>
          <h3>Checks</h3>
          <Checks claim={claim} />
        </div>
      </div>
      {!result && <button className="btn" disabled={busy || claim.tampered} onClick={submit}>{busy ? "Signing…" : "Submit and sign"}</button>}
      {result && <Alert cls={result.cls} title={result.title}>{result.text}</Alert>}
    </div>
  );
}

// Shows the network refusing a provider who tries to sign the participant's step.
function ImpersonationDemo({ claims }: { claims: ClaimView[] }) {
  const api = useApi();
  const target = claims.find((c) => c.nextStep === "confirmed");
  const [result, setResult] = useState<string | null>(null);

  async function tryIt() {
    if (!target) return;
    try {
      await api(`/api/claims/${encodeURIComponent(target.id)}/steps`, { method: "POST", body: JSON.stringify({ step: "confirmed" }) });
      setResult("Unexpected: the confirmation was accepted.");
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="panel">
      <h3>Try it: confirm on the participant&apos;s behalf</h3>
      <p>
        {target
          ? <>Claim <span className="mono">{target.id}</span> is waiting for the participant. What happens if you try to sign their confirmation yourself?</>
          : "When a claim is waiting for a participant's confirmation, you can try signing it yourself here."}
      </p>
      <button className="btn btn-danger" disabled={!target} onClick={tryIt}>Confirm for the participant</button>
      {result && <Alert cls="bad" title="Refused">{result} Only the participant can sign the confirmation step.</Alert>}
    </div>
  );
}

function ProviderDashboard() {
  const { claims, error, reload } = useClaims();
  const ready = (claims ?? []).filter((c) => c.nextStep === "submitted");

  return (
    <div className="container">
      {error && <Alert cls="bad" title="Couldn't load claims">{error}</Alert>}
      {claims && ready.length === 0 && <div className="panel"><p className="empty">No confirmed services waiting to be submitted.</p></div>}
      {ready.map((c) => <SubmitCard key={c.id} claim={c} onDone={reload} />)}
      <div className="panel">
        <h2>All claims for your organisation</h2>
        {claims ? <ClaimList claims={claims} empty="No claims yet." /> : <p className="empty">Loading…</p>}
      </div>
      {claims && <ImpersonationDemo claims={claims} />}
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero title="Provider dashboard">Check confirmed services against the agreement and submit them (step 3 of 4).</PageHero>
      <RoleGate role="provider"><ProviderDashboard /></RoleGate>
    </>
  );
}
