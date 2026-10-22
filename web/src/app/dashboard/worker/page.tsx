"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";
import { Alert, ClaimList, PageHero } from "@/components/Claim";
import type { ClaimView } from "@/lib/claims";
import { useApi } from "@/lib/useApi";
import { useClaims } from "@/lib/useClaims";

interface Participant { id: string; label: string; ndisNumber: string }

const ITEMS = [
  ["04_104_0125_6_1", "Community access (Core supports)"],
  ["01_011_0107_1_1", "Assistance with daily life (Core supports)"],
  ["04_590_0125_6_1", "Transport (Core supports)"],
];

function WorkerDashboard() {
  const api = useApi();
  const { claims, error, reload } = useClaims();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [form, setForm] = useState({ participantId: "", itemCode: ITEMS[0][0], serviceDate: new Date().toISOString().slice(0, 10), hours: "3" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cls: "ok" | "bad"; title: string; text?: React.ReactNode } | null>(null);

  useEffect(() => {
    api<{ participants: Participant[] }>("/api/participants")
      .then((d) => {
        setParticipants(d.participants);
        if (d.participants[0]) setForm((f) => ({ ...f, participantId: f.participantId || d.participants[0].id }));
      })
      .catch((e) => setResult({ cls: "bad", title: "Couldn't load your participants", text: e.message }));
  }, [api]);

  async function logAndSign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { claim } = await api<{ claim: ClaimView }>("/api/claims", {
        method: "POST",
        body: JSON.stringify({ ...form, hours: Number(form.hours) }),
      });
      await api(`/api/claims/${encodeURIComponent(claim.id)}/steps`, { method: "POST", body: JSON.stringify({ step: "delivered" }) });
      setResult({
        cls: "ok",
        title: "Service logged and signed.",
        text: <>The participant has been asked to confirm it. <Link href={`/claims/${encodeURIComponent(claim.id)}`}>See claim {claim.id} &rarr;</Link></>,
      });
      await reload();
    } catch (err) {
      setResult({ cls: "bad", title: "Not saved", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="two-col">
        <form className="panel" onSubmit={logAndSign}>
          <h2>Log a service</h2>
          <div className="field">
            <label htmlFor="participant">Participant</label>
            <select id="participant" value={form.participantId} onChange={(e) => setForm({ ...form, participantId: e.target.value })} required>
              {participants.length === 0 && <option value="">No assigned participants</option>}
              {participants.map((p) => <option key={p.id} value={p.id}>{p.label} (NDIS no. {p.ndisNumber})</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="item">Support</label>
            <select id="item" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })}>
              {ITEMS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="date">Date</label>
              <input id="date" type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="hours">Hours</label>
              <input id="hours" type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy || !form.participantId}>{busy ? "Signing…" : "Log and sign"}</button>
          {result && <Alert cls={result.cls} title={result.title}>{result.text}</Alert>}
        </form>

        <aside className="panel">
          <h3>What you&apos;re signing</h3>
          <p>&ldquo;I delivered this support to this participant, on this date, for these hours.&rdquo;</p>
          <p className="muted" style={{ marginBottom: 0 }}>After you sign, nobody can change these details without the signature breaking.</p>
        </aside>
      </div>

      <div className="panel">
        <h2>My claims</h2>
        {error && <Alert cls="bad" title="Couldn't load claims">{error}</Alert>}
        {claims ? <ClaimList claims={claims} empty="You haven't logged any services yet." /> : <p className="empty">Loading…</p>}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero title="Support worker dashboard">Log the supports you deliver and sign them (step 1 of 4).</PageHero>
      <RoleGate role="worker"><WorkerDashboard /></RoleGate>
    </>
  );
}
