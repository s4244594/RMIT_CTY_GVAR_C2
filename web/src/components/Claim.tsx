"use client";

import Link from "next/link";
import type { ClaimView } from "@/lib/claims";

export const STEP_LABEL: Record<string, string> = {
  delivered: "Service delivered",
  confirmed: "Service confirmed",
  disputed: "Disputed by participant",
  submitted: "Claim submitted",
  approved: "Claim approved",
};

const STEP_WHO: Record<string, string> = {
  delivered: "Support worker",
  confirmed: "Participant",
  submitted: "Provider",
  approved: "Agency approver",
};

export function money(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function niceDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function statusOf(c: ClaimView): { cls: "ok" | "bad" | "wait"; icon: string; title: string; text: string } {
  if (c.tampered) return { cls: "bad", icon: "⚠", title: "Unverified: claim data was changed after signing", text: "One or more signed steps no longer match the claim data. Payment is blocked." };
  if (c.disputed) return { cls: "bad", icon: "✗", title: "Disputed by the participant", text: "The participant said this service did not happen. The claim stops here." };
  if (c.paid) return { cls: "ok", icon: "✓", title: "Paid", text: "Four signatures from four different people, all still matching. Payment released." };
  if (!c.nextStep) return { cls: "ok", icon: "✓", title: "Verified and payable", text: "All four steps are signed and every signature matches the claim data." };
  const done = c.steps.length;
  return { cls: "wait", icon: "⌛", title: `In progress: waiting for ${STEP_WHO[c.nextStep]?.toLowerCase()}`, text: `${done} of 4 steps signed.` };
}

export function StatusBanner({ claim }: { claim: ClaimView }) {
  const s = statusOf(claim);
  return (
    <div className={`status-banner ${s.cls}`}>
      <span className="icon" aria-hidden>{s.icon}</span>
      <div><h2>{s.title}</h2><p>{s.text}</p></div>
    </div>
  );
}

export function StatusBadge({ claim }: { claim: ClaimView }) {
  const s = statusOf(claim);
  const short = claim.tampered ? "Changed after signing" : claim.disputed ? "Disputed" : claim.paid ? "Paid"
    : !claim.nextStep ? "Payable" : `Waiting: ${STEP_WHO[claim.nextStep]}`;
  return <span className={`badge ${s.cls}`}>{short}</span>;
}

export function ClaimFacts({ claim }: { claim: ClaimView }) {
  return (
    <dl className="kv">
      <dt>Claim</dt><dd className="mono">{claim.id}</dd>
      <dt>Participant</dt><dd>{claim.participant.label}</dd>
      <dt>Support worker</dt><dd>{claim.worker.label}</dd>
      <dt>Provider</dt><dd>{claim.providerOrg}</dd>
      <dt>Support</dt><dd>{claim.service}</dd>
      <dt>Support item</dt><dd className="mono">{claim.supportItemCode}</dd>
      <dt>Date</dt><dd>{niceDate(claim.serviceDate)}</dd>
      <dt>Hours</dt><dd>{claim.hours}</dd>
      <dt>Rate</dt><dd>{money(claim.rate)} / hour</dd>
      <dt>Amount</dt><dd>{money(claim.amount)}</dd>
    </dl>
  );
}

export function SignatureChain({ claim }: { claim: ClaimView }) {
  const order = ["delivered", claim.disputed ? "disputed" : "confirmed", "submitted", "approved"];
  return (
    <ol className="chain">
      {order.map((step, i) => {
        const s = claim.steps.find((x) => x.step === step);
        const cls = !s ? "" : s.matches ? "ok" : "bad";
        return (
          <li key={step} className={cls}>
            <span className="node">{!s ? i + 1 : s.matches ? "✓" : "!"}</span>
            <div className="step-head">
              <h3>{STEP_LABEL[step]}</h3>
              {!s ? <span className="badge wait">Waiting</span>
                : s.matches ? <span className="badge ok">✓ Signature matches</span>
                : <span className="badge bad">⚠ Data changed after signing</span>}
            </div>
            <div className="meta">
              {s ? (
                <>
                  Signed by <strong>{s.signer.label}</strong> &middot; {new Date(s.signedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}<br />
                  Signature <span className="sig">{s.signature.slice(0, 24)}…</span>
                  {step === "confirmed" || step === "disputed" ? <><br />Only the participant can make this statement.</> : null}
                </>
              ) : (
                <>To be signed by the {STEP_WHO[step]?.toLowerCase()}</>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Checks({ claim }: { claim: ClaimView }) {
  return (
    <ul className="checklist">
      {claim.checks.map((c) => (
        <li key={c.label}>
          <span className={`mark ${c.ok ? "ok" : "bad"}`}>{c.ok ? "✓" : "✗"}</span>
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ClaimList({ claims, empty }: { claims: ClaimView[]; empty: string }) {
  if (claims.length === 0) return <p className="empty">{empty}</p>;
  return (
    <ul className="claim-list">
      {claims.map((c) => (
        <li key={c.id}>
          <div>
            <Link href={`/claims/${encodeURIComponent(c.id)}`} className="mono">{c.id}</Link>
            <div className="muted">{c.service.split(" (")[0]} &middot; {c.hours} h &middot; {money(c.amount)} &middot; {c.participant.label}</div>
          </div>
          <StatusBadge claim={c} />
        </li>
      ))}
    </ul>
  );
}

export function Alert({ cls, title, children }: { cls?: "ok" | "bad" | "wait"; title: string; children?: React.ReactNode }) {
  return (
    <div className={`alert ${cls ?? ""}`}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function PageHero({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="hero hero-small">
      <div className="container">
        <h1>{title}</h1>
        {children ? <p>{children}</p> : null}
      </div>
    </section>
  );
}
