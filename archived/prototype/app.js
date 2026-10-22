// NDIS Claim Chain prototype: shared demo state, header/footer and page behaviour.
// Login and signatures are simulated. In the real app, sign-in happens on TideCloak's
// own page, the Tide network signs each step, and the server re-checks every signature.

const KEY = "claimchain.v2";

// One role per person. The username is what they type on the TideCloak sign-in page.
const ROLES = {
  worker: { label: "Support worker", name: "Sam Patel", username: "sam.patel", page: "dashboard-worker.html", icon: "&#9881;" },
  participant: { label: "Participant", name: "Mia Nguyen", username: "mia.nguyen", page: "dashboard-participant.html", icon: "&#9786;" },
  provider: { label: "Provider", name: "Jordan Lee (Brightpath Supports)", username: "jordan.lee", page: "dashboard-provider.html", icon: "&#9873;" },
  approver: { label: "Agency approver", name: "Alex Romero (NDIA)", username: "alex.romero", page: "dashboard-approver.html", icon: "&#10003;" },
  admin: { label: "System admin", name: "Chris Admin", username: "chris.admin", page: "dashboard-admin.html", icon: "&#9874;" },
};
const DEMO_PASSWORD = "demo123";

const STEPS = [
  { key: "worker", label: "Service delivered", mode: "role" },
  { key: "participant", label: "Service confirmed", mode: "self" },
  { key: "provider", label: "Claim submitted", mode: "role" },
  { key: "approver", label: "Claim approved", mode: "role" },
];

function defaults() {
  return {
    role: null,
    claim: {
      id: "CLM-2026-0417",
      participantNo: "43 012 345 6",
      service: "Community access (Core supports)",
      itemCode: "04_104_0125_6_1",
      date: "2026-10-20",
      hours: 3,
      rate: 67.56,
      notes: "Supported Mia at the library and the community garden.",
    },
    steps: {},
    dispute: null,
    released: false,
    gov: { requested: false, approvals: [], committed: false },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* storage blocked: fall back to a fresh demo */ }
  return defaults();
}

function save(st) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
}

function resetDemo() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

// ---------- Simulated signing ----------

function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function hash(str) {
  return fnv(str, 2166136261) + fnv(str, 374761393) + fnv(str, 668265263) + fnv(str, 3266489917);
}

function amount(c) {
  return Math.round(c.hours * c.rate * 100) / 100;
}

// The statement each person signs. Built from the claim data, never stored.
function statement(st, i) {
  const c = st.claim;
  const prevStep = i > 0 ? st.steps[STEPS[i - 1].key] : null;
  return JSON.stringify({
    claim: c.id,
    step: STEPS[i].key,
    mode: STEPS[i].mode,
    issuer: ROLES[STEPS[i].key].name,
    subject: ROLES.participant.name,
    service: c.service,
    date: c.date,
    hours: c.hours,
    amount: amount(c),
    prev: prevStep ? prevStep.sig : "start",
  });
}

function signStep(st, i) {
  st.steps[STEPS[i].key] = {
    by: ROLES[STEPS[i].key].name,
    at: new Date().toISOString(),
    sig: hash(statement(st, i)),
  };
}

// Rebuild every signed statement from the current data and compare.
function verify(st) {
  return STEPS.map((s, i) => {
    const signed = st.steps[s.key];
    if (!signed) return "pending";
    return hash(statement(st, i)) === signed.sig ? "ok" : "bad";
  });
}

function nextIndex(st) {
  return STEPS.findIndex((s) => !st.steps[s.key]);
}

function overall(st) {
  const v = verify(st);
  if (v.includes("bad")) {
    return { cls: "bad", icon: "&#9888;", title: "Unverified: claim data was changed after signing",
      text: "One or more signed steps no longer match the claim data. Payment is blocked." };
  }
  if (st.dispute) {
    return { cls: "bad", icon: "&#10007;", title: "Disputed by the participant",
      text: "Mia said this service did not happen. The claim cannot proceed." };
  }
  if (st.released) {
    return { cls: "ok", icon: "&#10003;", title: "Paid",
      text: "Four verified signatures from four different people. Payment released." };
  }
  const n = nextIndex(st);
  if (n === -1) {
    return { cls: "ok", icon: "&#10003;", title: "Verified and payable",
      text: "All four steps are signed and every signature matches the claim data." };
  }
  return { cls: "wait", icon: "&#8987;", title: "In progress: waiting for " + ROLES[STEPS[n].key].label.toLowerCase(),
    text: n + " of 4 steps signed." };
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function money(n) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Tells the signed-in person who acts next, without linking to anyone else's dashboard.
function handoff(st) {
  const n = nextIndex(st);
  if (n === -1 || st.dispute) return '<a href="claim.html">See claim status &rarr;</a>';
  const r = ROLES[STEPS[n].key];
  return `${esc(r.name)} (${r.label.toLowerCase()}) has been notified. <a href="claim.html">See claim status &rarr;</a>`;
}

// ---------- Shared rendering ----------

function renderHeader(st) {
  const here = location.pathname.split("/").pop() || "index.html";
  const role = st.role ? ROLES[st.role] : null;
  const nav = role
    ? [["index.html", "Home"], [role.page, "My dashboard"], ["claim.html", "Claim status"], ["plan.html", "Plan details"]]
    : [["index.html", "Home"], ["login.html", "Sign in"]];
  const header = document.getElementById("site-header");
  if (!header) return;
  header.innerHTML = `
    <div class="notice-bar"><div class="container">
      <span class="notice-tag">Prototype</span>
      <span>Hackathon concept for RMIT Industry Challenge 2. Not an official NDIS or NDIA service. All people and data are fictional.</span>
    </div></div>
    <div class="site-header"><div class="container">
      <a class="brand" href="index.html" aria-label="NDIS Claim Chain home">
        <span class="logo logo-sm">nd<span class="i">&#305;<span class="dot"></span></span>s</span>
        <span class="brand-text">Claim Chain<small>Signed, shared claims</small></span>
      </a>
      <div class="utility">
        ${role
          ? `<span class="whoami">Signed in as <strong>${esc(role.name)}</strong> &middot; ${role.label}</span>
             <button class="util-btn primary" id="sign-out">Sign out</button>`
          : `<a class="util-btn primary" href="login.html">Sign in &#9662;</a>`}
      </div>
    </div></div>
    <nav class="main-nav" aria-label="Main"><div class="container"><ul>
      ${nav.map(([href, text]) => `<li><a href="${href}"${href === here ? ' aria-current="page"' : ""}>${text}</a></li>`).join("")}
    </ul></div></nav>`;

  const out = document.getElementById("sign-out");
  if (out) out.addEventListener("click", () => {
    st.role = null;
    save(st);
    location.href = "index.html";
  });

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="container">
      <span>NDIS Claim Chain prototype &middot; built with TideCloak</span>
      <span><a href="#" id="reset-demo">Reset demo</a></span>
    </div>`;
    document.getElementById("reset-demo").addEventListener("click", (e) => {
      e.preventDefault();
      resetDemo();
      location.href = "index.html";
    });
  }
}

function renderChain(el, st) {
  const v = verify(st);
  el.innerHTML = STEPS.map((s, i) => {
    const signed = st.steps[s.key];
    const r = ROLES[s.key];
    const badge = v[i] === "ok" ? '<span class="badge ok">&#10003; Signature matches</span>'
      : v[i] === "bad" ? '<span class="badge bad">&#9888; Data changed after signing</span>'
      : '<span class="badge wait">Waiting</span>';
    const meta = signed
      ? `Signed by <strong>${esc(signed.by)}</strong> (${r.label}) &middot; ${fmtTime(signed.at)}<br>
         Signature <span class="sig">${signed.sig.slice(0, 24)}&hellip;</span>
         ${s.mode === "self" ? "<br>Self statement: only the participant can make it." : ""}`
      : `To be signed by ${esc(r.name)} (${r.label})`;
    return `<li class="${v[i]}"><span class="node">${v[i] === "ok" ? "&#10003;" : v[i] === "bad" ? "!" : i + 1}</span>
      <div class="step-head"><h3>${s.label}</h3>${badge}</div>
      <div class="meta">${meta}</div></li>`;
  }).join("");
}

function renderStatus(el, st) {
  const o = overall(st);
  el.className = "status-banner " + o.cls;
  el.innerHTML = `<span class="icon">${o.icon}</span><div><h2>${o.title}</h2><p>${o.text}</p></div>`;
}

function renderClaimSummary(el, st) {
  const c = st.claim;
  el.innerHTML = `
    <dt>Claim</dt><dd>${c.id}</dd>
    <dt>Participant</dt><dd>${ROLES.participant.name} (NDIS no. ${c.participantNo})</dd>
    <dt>Support</dt><dd>${esc(c.service)}</dd>
    <dt>Support item</dt><dd>${c.itemCode}</dd>
    <dt>Date</dt><dd>${new Date(c.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</dd>
    <dt>Hours</dt><dd>${c.hours}</dd>
    <dt>Rate</dt><dd>${money(c.rate)} / hour</dd>
    <dt>Amount</dt><dd>${money(amount(c))}</dd>`;
}

function fillAll(st) {
  document.querySelectorAll("[data-chain]").forEach((el) => renderChain(el, st));
  document.querySelectorAll("[data-status]").forEach((el) => renderStatus(el, st));
  document.querySelectorAll("[data-summary]").forEach((el) => renderClaimSummary(el, st));
  document.querySelectorAll("[data-name]").forEach((el) => { if (st.role) el.textContent = ROLES[st.role].name.split(" ")[0]; });
}

function showAlert(el, cls, title, text) {
  el.innerHTML = `<div class="alert ${cls}"><strong>${title}</strong><p>${text}</p></div>`;
}

// Access check. Signed out: go to sign-in. Wrong role: no access.
// In the real app the server makes this decision from the TideCloak token on every request.
function gate(st) {
  const need = document.body.dataset.role;
  if (!need) return true;
  if (!st.role) {
    location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop()));
    return false;
  }
  const content = document.getElementById("role-content");
  const gateEl = document.getElementById("role-gate");
  if (need === "any" || st.role === need) {
    if (gateEl) gateEl.classList.add("hidden");
    if (content) content.classList.remove("hidden");
    return true;
  }
  const mine = ROLES[st.role];
  gateEl.classList.remove("hidden");
  content.classList.add("hidden");
  gateEl.innerHTML = `<div class="panel gate">
    <div class="topic-icon center">&#128274;</div>
    <h2 style="margin-top:16px">You don't have access to this page</h2>
    <p class="lead center">This dashboard is for the ${ROLES[need].label.toLowerCase()}. You're signed in as a ${mine.label.toLowerCase()}, and each account has one role.</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn" href="${mine.page}">Go to my dashboard</a>
    </div></div>`;
  return false;
}

// ---------- Page behaviour ----------

const pages = {
  home(st) {
    const cta = document.getElementById("home-cta");
    if (st.role) {
      cta.innerHTML = `<a class="btn btn-light" href="${ROLES[st.role].page}">Go to my dashboard</a>`;
    }
  },

  login(st) {
    if (st.role) {
      location.replace(ROLES[st.role].page);
      return;
    }
    const form = document.getElementById("tide-form");
    const out = document.getElementById("login-result");
    document.getElementById("demo-accounts").innerHTML = Object.values(ROLES).map((r) =>
      `<tr><td><button type="button" class="sig" data-user="${r.username}" style="cursor:pointer">${r.username}</button></td><td>${r.label}</td></tr>`).join("");
    document.getElementById("demo-accounts").addEventListener("click", (e) => {
      const b = e.target.closest("[data-user]");
      if (!b) return;
      form.username.value = b.dataset.user;
      form.password.value = DEMO_PASSWORD;
      form.username.focus();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = form.username.value.trim().toLowerCase();
      const role = Object.keys(ROLES).find((k) => ROLES[k].username === user);
      if (!role || form.password.value !== DEMO_PASSWORD) {
        showAlert(out, "bad", "Sign-in failed", "Username or password is incorrect.");
        return;
      }
      form.querySelector("button[type=submit]").disabled = true;
      showAlert(out, "wait", "Checking with the Tide network&hellip;",
        "Independent nodes check your password. None of them ever sees it or stores it.");
      setTimeout(() => {
        st.role = role;
        save(st);
        location.href = ROLES[role].page;
      }, 1100);
    });
  },

  worker(st) {
    if (!gate(st)) return;
    const c = st.claim;
    const form = document.getElementById("service-form");
    const out = document.getElementById("result");
    form.service.value = c.service;
    form.date.value = c.date;
    form.hours.value = c.hours;
    form.notes.value = c.notes;
    const lock = () => {
      [...form.elements].forEach((f) => {
        if (f.tagName === "SELECT") f.disabled = true;
        else if (f.tagName !== "BUTTON") f.readOnly = true;
      });
      form.querySelector("button").disabled = true;
    };
    if (st.steps.worker) {
      lock();
      showAlert(out, "ok", "You've signed this service.", handoff(st));
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const hours = Number(form.hours.value);
      if (!(hours > 0 && hours <= 12)) {
        showAlert(out, "bad", "Check the hours", "Hours must be between 0 and 12.");
        return;
      }
      c.service = form.service.value;
      c.date = form.date.value;
      c.hours = hours;
      c.notes = form.notes.value;
      signStep(st, 0);
      save(st);
      lock();
      showAlert(out, "ok", "Signed by the Tide network.",
        "The network checked that you hold the support worker role and that you're the person named on this step. " + handoff(st));
      fillAll(st);
    });
  },

  participant(st) {
    if (!gate(st)) return;
    const c = st.claim;
    const box = document.getElementById("confirm-box");
    const out = document.getElementById("result");
    if (!st.steps.worker) {
      box.innerHTML = `<p class="big-q">Nothing to confirm yet</p>
        <p>When your support worker logs a service, it will appear here for you to check.</p>`;
      return;
    }
    box.innerHTML = `
      <p class="badge">Needs your answer</p>
      <p class="big-q">Did this happen?</p>
      <p class="service-line"><strong>${esc(c.service.split(" (")[0])}</strong> with ${ROLES.worker.name}</p>
      <p class="service-line">${new Date(c.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
      <p class="service-line">${c.hours} hours &middot; ${money(amount(c))} from your plan</p>
      <div class="btn-row" style="flex-direction:column">
        <button class="btn btn-green btn-big" id="yes">&#10003; Yes, this happened</button>
        <button class="btn btn-danger btn-big" id="no">&#10007; No, this didn't happen</button>
      </div>`;
    const done = () => box.querySelectorAll("button").forEach((b) => (b.disabled = true));
    if (st.steps.participant || st.dispute) done();
    if (st.steps.participant) showAlert(out, "ok", "You've confirmed this service.", "Thanks, Mia. " + handoff(st));
    if (st.dispute) showAlert(out, "bad", "You've said this didn't happen.", "The claim is stopped and your provider has been told.");

    box.querySelector("#yes").addEventListener("click", () => {
      signStep(st, 1);
      save(st);
      done();
      showAlert(out, "ok", "Confirmed and signed.",
        "This is a <em>self</em> statement: the Tide network only signs it when the person signing is you. " + handoff(st));
      fillAll(st);
    });
    box.querySelector("#no").addEventListener("click", () => {
      st.dispute = { by: ROLES.participant.name, at: new Date().toISOString() };
      save(st);
      done();
      showAlert(out, "bad", "Dispute recorded and signed.",
        "Nothing is deleted. Your answer is added to the claim as a new signed step, and the claim stops here. "
        + '<a href="claim.html">See claim status &rarr;</a>');
      fillAll(st);
    });
  },

  provider(st) {
    if (!gate(st)) return;
    const out = document.getElementById("result");
    const btn = document.getElementById("submit-claim");
    const ready = st.steps.worker && st.steps.participant && !st.dispute;
    const v = verify(st);
    document.getElementById("provider-checks").innerHTML = [
      [v[0] === "ok", "Worker's step is signed and matches the claim data"],
      [v[1] === "ok", "Participant has confirmed the service"],
      [true, "Support item is in Mia's service agreement"],
      [st.claim.rate <= 67.56, "Rate is within the price limit"],
    ].map(([ok, t]) => `<li><span class="mark ${ok ? "ok" : "wait"}">${ok ? "&#10003;" : "&#8987;"}</span><span>${t}</span></li>`).join("");

    if (st.steps.provider) {
      btn.disabled = true;
      showAlert(out, "ok", "Claim submitted.", handoff(st));
    } else if (!ready) {
      btn.disabled = true;
      showAlert(out, "wait", "Not ready to submit", st.dispute ? "The participant disputed this service." : "The participant hasn't confirmed this service yet.");
    }
    btn.addEventListener("click", () => {
      if (verify(st).includes("bad")) {
        showAlert(out, "bad", "Refused", "A signed step no longer matches the claim data.");
        return;
      }
      signStep(st, 2);
      save(st);
      btn.disabled = true;
      showAlert(out, "ok", "Claim submitted and signed.", handoff(st));
      fillAll(st);
    });

    document.getElementById("impersonate").addEventListener("click", () => {
      showAlert(document.getElementById("impersonate-result"), "bad", "Refused by the Tide network",
        "&ldquo;Under a self rule you can only attest about yourself.&rdquo; You're signed in as Jordan Lee, "
        + "and the confirmation step must be signed by Mia Nguyen. No provider, admin or server can sign it for her.");
    });
  },

  approver(st) {
    if (!gate(st)) return;
    const c = st.claim;
    const out = document.getElementById("result");
    const approve = document.getElementById("approve");
    const release = document.getElementById("release");
    const v = verify(st);
    const signers = STEPS.map((s) => st.steps[s.key] && st.steps[s.key].by).filter(Boolean);
    const distinct = new Set(signers).size === signers.length;
    const rows = [
      [v.slice(0, 3).every((x) => x === "ok") ? "ok" : v.includes("bad") ? "bad" : "wait", "Worker, participant and provider steps signed, and every signature matches the claim data"],
      [distinct ? "ok" : "bad", "Each step signed by a different person"],
      [c.hours <= 8 ? "ok" : "bad", "No more than 8 hours of this support on one day (" + c.hours + " claimed)"],
      [c.rate <= 67.56 ? "ok" : "bad", "Rate within the price limit (" + money(c.rate) + ")"],
      [amount(c) <= 4200 ? "ok" : "bad", "Within remaining Core budget (" + money(4200) + ")"],
      [!st.dispute ? "ok" : "bad", "Not disputed by the participant"],
    ];
    document.getElementById("rule-checks").innerHTML = rows.map(([s, t]) =>
      `<li><span class="mark ${s}">${s === "ok" ? "&#10003;" : s === "bad" ? "&#10007;" : "&#8987;"}</span><span>${t}</span></li>`).join("");
    const allOk = rows.every(([s]) => s === "ok");

    approve.disabled = !allOk || !!st.steps.approver;
    release.disabled = !st.steps.approver || st.released || !v.every((x) => x === "ok");

    if (v.includes("bad")) {
      showAlert(out, "bad", "Payment blocked", 'Claim data was changed after it was signed. <a href="claim.html">See which steps no longer match &rarr;</a>');
    } else if (st.released) {
      showAlert(out, "ok", "Payment released", money(amount(c)) + " released to Brightpath Supports.");
    } else if (st.steps.approver) {
      showAlert(out, "ok", "Claim approved.", "All four steps are signed. You can now release payment.");
    } else if (!allOk) {
      showAlert(out, "wait", "Not ready to approve", "Some checks haven't passed yet.");
    }

    approve.addEventListener("click", () => {
      signStep(st, 3);
      save(st);
      location.reload();
    });
    release.addEventListener("click", () => {
      if (!verify(st).every((x) => x === "ok")) return;
      st.released = true;
      save(st);
      location.reload();
    });
  },

  claim(st) {
    if (!gate(st)) return;
    const stmt = document.getElementById("statement");
    const n = nextIndex(st);
    const i = n === -1 ? 3 : Math.max(0, n - 1);
    stmt.textContent = JSON.stringify(JSON.parse(statement(st, i)), null, 2);
    document.getElementById("statement-label").textContent = STEPS[i].label;
    const next = document.getElementById("next-action");
    if (n !== -1 && !st.dispute && STEPS[n].key === st.role) {
      next.innerHTML = `<a class="btn" href="${ROLES[st.role].page}">It's your turn: go to my dashboard &rarr;</a>`;
    } else if (n === -1 && !st.released && st.role === "approver" && !verify(st).includes("bad")) {
      next.innerHTML = `<a class="btn btn-green" href="${ROLES.approver.page}">Release payment &rarr;</a>`;
    }
  },

  plan(st) {
    if (!gate(st)) return;
    const access = {
      participant: ["goals", "needs", "diagnosis", "funding", "agreement"],
      worker: ["goals", "needs"],
      provider: ["funding", "agreement"],
      approver: ["funding", "agreement"],
      admin: [],
    };
    const fields = [
      ["goals", "My goals", "Build confidence getting around my local community; join a gardening group."],
      ["needs", "Support needs", "Prefers a familiar worker. Needs a quiet space after outings."],
      ["diagnosis", "Diagnosis and health", "[Sensitive health information]"],
      ["funding", "Funding", "Core supports $12,600 &middot; $4,200 remaining"],
      ["agreement", "Service agreement", "Brightpath Supports: community access, up to 6 h per week"],
    ];
    const r = st.role;
    const can = access[r];
    document.getElementById("plan-rows").innerHTML = fields.map(([k, label, val]) => {
      const ok = can.includes(k);
      return `<tr><th scope="row">${label}</th>
        <td>${ok ? val : `<span class="locked">${hash(k + val).slice(0, 40)}&hellip;</span>`}</td>
        <td>${ok ? '<span class="badge ok">&#128275; Can open</span>' : '<span class="badge bad">&#128274; Encrypted</span>'}</td></tr>`;
    }).join("");
    document.getElementById("plan-note").innerHTML = r === "admin"
      ? `<div class="alert bad"><strong>As an admin, you can't read any of this.</strong><p>Running the system doesn't give access to the data. Only the Tide network can decrypt it, and only for people Mia's records are shared with.</p></div>`
      : `<div class="alert"><strong>${ROLES[r].label}: you can open ${can.length} of ${fields.length} records</strong><p>Each record is encrypted separately, so access is granted record by record. Changing who can open a record needs approval from two admins.</p></div>`;
  },

  admin(st) {
    if (!gate(st)) return;
    const c = st.claim;
    const hours = document.getElementById("db-hours");
    const out = document.getElementById("db-result");
    hours.value = c.hours;
    document.getElementById("db-save").addEventListener("click", () => {
      const h = Number(hours.value);
      if (!(h > 0)) return;
      c.hours = h;
      save(st);
      if (Object.keys(st.steps).length === 0) {
        showAlert(out, "wait", "Saved", "Nothing has been signed yet, so there's nothing to break. Sign some steps first to see the tamper test.");
      } else if (verify(st).includes("bad")) {
        showAlert(out, "bad", "Saved to the database, and the claim is now unverified.",
          'The database accepted the edit, but the signed steps no longer match. <a href="claim.html">See the claim &rarr;</a>');
      } else {
        showAlert(out, "ok", "Saved, and the signatures match again.", 'The data is back to what everyone signed. <a href="claim.html">See the claim &rarr;</a>');
      }
    });

    const gov = st.gov;
    const govOut = document.getElementById("gov-result");
    const req = document.getElementById("gov-request");
    const second = document.getElementById("gov-second");
    const selfApprove = document.getElementById("gov-self");
    const renderGov = () => {
      req.disabled = gov.requested;
      selfApprove.disabled = !gov.requested || gov.committed;
      second.disabled = !gov.requested || gov.committed;
      if (gov.committed) {
        showAlert(govOut, "ok", "Change committed: 2 of 3 admins approved.", "Taylor Kim now holds the agency approver role. A second admin had to agree.");
      } else if (gov.requested) {
        showAlert(govOut, "wait", "Pending: 1 of 2 approvals.",
          "Chris Admin requested this change. Taylor can't approve claims until a second admin agrees.");
      } else {
        govOut.innerHTML = "";
      }
    };
    renderGov();
    req.addEventListener("click", () => {
      gov.requested = true;
      gov.approvals = ["Chris Admin"];
      save(st);
      renderGov();
    });
    selfApprove.addEventListener("click", () => {
      showAlert(govOut, "bad", "Refused: you've already approved this.",
        "The same admin can't approve twice. Needs 2 of 3 admins (Chris, Priya, Tom).");
    });
    second.addEventListener("click", () => {
      gov.approvals.push("Priya Shah");
      gov.committed = true;
      save(st);
      renderGov();
    });
    document.getElementById("gov-reset").addEventListener("click", () => {
      st.gov = { requested: false, approvals: [], committed: false };
      save(st);
      location.reload();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const st = load();
  renderHeader(st);
  const page = document.body.dataset.page;
  if (pages[page]) pages[page](st);
  fillAll(st);
});
