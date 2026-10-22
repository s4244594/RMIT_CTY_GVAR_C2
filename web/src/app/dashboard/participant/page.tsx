"use client";

import { useEffect, useState } from "react";
import { RoleGate } from "@/components/RoleGate";
import { Alert, ClaimList, money, niceDate, PageHero } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useAppAuth } from "@/lib/auth/appAuth";
import {
  decodePlanCiphertext,
  decodePlanText,
  encodePlanCiphertext,
  PLAN_KINDS,
  PLAN_KIND_LABELS,
  planTagForParticipant,
  type PlanKind,
} from "@/lib/planRecords";
import { useApi } from "@/lib/useApi";
import { useClaims } from "@/lib/useClaims";

function ConfirmCard({ claim, onDone }: { claim: ClaimView; onDone: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cls: "ok" | "bad"; title: string; text: string } | null>(null);

  async function answer(step: "confirmed" | "disputed") {
    setBusy(true);
    try {
      await api(`/api/claims/${encodeURIComponent(claim.id)}/steps`, { method: "POST", body: JSON.stringify({ step }) });
      setResult(step === "confirmed"
        ? { cls: "ok", title: "Confirmed and signed.", text: "Your provider can now submit the claim." }
        : { cls: "bad", title: "You've said this didn't happen.", text: "Your answer is signed and added to the claim, and the claim stops here." });
      onDone();
    } catch (e) {
      setResult({ cls: "bad", title: "Not saved", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone">
      <span className="badge">Needs your answer</span>
      <p className="big-q">Did this happen?</p>
      <p className="service-line"><strong>{claim.service.split(" (")[0]}</strong> with {claim.worker.label}</p>
      <p className="service-line">{niceDate(claim.serviceDate)}</p>
      <p className="service-line">{claim.hours} hours &middot; {money(claim.amount)} from your plan</p>
      {!result && (
        <div className="btn-row" style={{ flexDirection: "column" }}>
          <button className="btn btn-green btn-big" disabled={busy} onClick={() => answer("confirmed")}>✓ Yes, this happened</button>
          <button className="btn btn-danger btn-big" disabled={busy} onClick={() => answer("disputed")}>✗ No, this didn&apos;t happen</button>
        </div>
      )}
      {result && <Alert cls={result.cls} title={result.title}>{result.text}</Alert>}
    </div>
  );
}

type PlanRecord = { kind: PlanKind; ciphertext: string };
type PlanTexts = Record<PlanKind, string>;

const emptyPlan: PlanTexts = {
  goals: "",
  support_needs: "",
  health: "",
  funding: "",
  service_agreement: "",
};

function ParticipantPlan() {
  const api = useApi();
  const { authenticated, doDecrypt, doEncrypt, isSimulated, username } = useAppAuth();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [texts, setTexts] = useState<PlanTexts>(emptyPlan);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<PlanKind | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await api<{ participantId: string; records: PlanRecord[] }>("/api/me/plan");
        const tag = planTagForParticipant(data.participantId);
        const values = await doDecrypt(data.records.map((record) => ({
          encrypted: decodePlanCiphertext(record.ciphertext),
          tags: [tag],
        })));
        if (cancelled) return;
        const loaded = { ...emptyPlan };
        data.records.forEach((record, index) => {
          const value = values[index];
          if (value !== undefined) loaded[record.kind] = decodePlanText(value);
        });
        setParticipantId(data.participantId);
        setTexts(loaded);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [api, authenticated, doDecrypt, isSimulated, username]);

  async function save(kind: PlanKind) {
    if (!participantId) return;
    setBusy(kind);
    setSaved(null);
    setError(null);
    try {
      const tag = planTagForParticipant(participantId);
      const [encrypted] = await doEncrypt([{ data: texts[kind], tags: [tag] }]);
      if (encrypted === undefined) throw new Error("Tide did not return encrypted plan data.");
      await api("/api/me/plan", {
        method: "PUT",
        body: JSON.stringify({ kind, ciphertext: encodePlanCiphertext(encrypted) }),
      });
      setSaved(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <h2>My support plan</h2>
      <p>{isSimulated
        ? "Local test encryption is active. The test key stays in this browser tab and is not managed by Tide. Use fictional data only."
        : "These records are encrypted in your browser. Only your Tide account can decrypt them."}</p>
      {error && <Alert cls="bad" title="Plan not available">{error}</Alert>}
      {loading ? <p className="empty">Loading plan…</p> : PLAN_KINDS.map((kind) => (
        <div className="field" key={kind}>
          <label htmlFor={`plan-${kind}`}>{PLAN_KIND_LABELS[kind]}</label>
          <textarea
            id={`plan-${kind}`}
            rows={3}
            value={texts[kind]}
            onChange={(event) => setTexts({ ...texts, [kind]: event.target.value })}
            disabled={busy !== null}
          />
          <button className="btn" type="button" disabled={busy !== null} onClick={() => void save(kind)}>
            {busy === kind ? "Encrypting and saving…" : "Save encrypted"}
          </button>
          {saved === kind && <p role="status">Saved encrypted.</p>}
        </div>
      ))}
    </section>
  );
}

function ParticipantDashboard() {
  const { claims, error, reload } = useClaims();
  const waiting = (claims ?? []).filter((c) => c.nextStep === "confirmed" && !c.tampered);

  return (
    <div className="container">
      {error && <Alert cls="bad" title="Couldn't load your claims">{error}</Alert>}
      {claims && waiting.length === 0 && (
        <div className="phone"><p className="big-q">Nothing to confirm</p><p>When your support worker logs a service, it will appear here for you to check.</p></div>
      )}
      {waiting.map((c) => <ConfirmCard key={c.id} claim={c} onDone={reload} />)}

      <ParticipantPlan />

      <div className="panel" style={{ maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
        <h3>Why only you can confirm</h3>
        <p style={{ marginBottom: 0 }}>
          Your confirmation is a statement about yourself. It can only be signed by you, signed in as you. Your provider,
          the agency and system admins can&apos;t confirm on your behalf.
        </p>
      </div>

      <div className="panel">
        <h2>My claims</h2>
        {claims ? <ClaimList claims={claims} empty="No claims yet." /> : <p className="empty">Loading…</p>}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero title="Participant dashboard">You have the final say on whether a support happened (step 2 of 4).</PageHero>
      <RoleGate role="participant"><ParticipantDashboard /></RoleGate>
    </>
  );
}
