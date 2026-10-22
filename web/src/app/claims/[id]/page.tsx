"use client";

import { use, useEffect, useState } from "react";
import { useAppAuth } from "@/lib/auth/appAuth";
import { RoleGate } from "@/components/RoleGate";
import { Alert, ClaimFacts, PageHero, SignatureChain, StatusBanner } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useApi } from "@/lib/useApi";

function ClaimStatus({ id }: { id: string }) {
  const api = useApi();
  const { authenticated } = useAppAuth();
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    api<{ claim: ClaimView }>(`/api/claims/${encodeURIComponent(id)}`)
      .then((d) => setClaim(d.claim))
      .catch((e) => setError(e.message));
  }, [api, authenticated, id]);

  if (error) return <div className="container"><Alert cls="bad" title="Couldn't load this claim">{error}</Alert></div>;
  if (!claim) return <div className="container loading">Loading…</div>;

  return (
    <div className="container">
      <StatusBanner claim={claim} />
      <div className="two-col">
        <div className="panel">
          <h2>Signature chain</h2>
          <SignatureChain claim={claim} />
        </div>
        <aside className="panel">
          <h3>Claim details</h3>
          <ClaimFacts claim={claim} />
        </aside>
      </div>
      <div className="panel">
        <h3>How this is checked</h3>
        <p style={{ marginBottom: 0 }}>
          Each time this page loads, the server rebuilds every signed statement from the claim data above and checks it
          against its signature. Each statement also includes the signature of the step before it, so steps can&apos;t be
          reordered or swapped.
        </p>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <PageHero title="Claim status">Anyone on this claim can check it. Every signature is re-checked against the claim data each time.</PageHero>
      <RoleGate role="any"><ClaimStatus id={decodeURIComponent(id)} /></RoleGate>
    </>
  );
}
