import { buildDaySegments, toMin } from "./schedule.js";

const GSAP_URL = "https://cdn.jsdelivr.net/npm/gsap@3/+esm";

const STEPS = [
  { title: "Open ✨ Personalize and describe your goal", text: "Click the ✨ Personalize tab (first tab at the top), write what you want to achieve and pick your dates. Cheapest AI models are listed first." },
  { title: "AI builds your plan", text: "The AI turns your goal into a day-by-day plan with a concrete checklist for every focus block." },
  { title: "Your day, block by block", text: "Focus blocks, breaks, meals and sleep are scheduled for you. The Right Now panel always shows what to do." },
  { title: "Check it off", text: "Tick tasks as you finish them and watch the day fill up." },
  { title: "Switch plans, see what you've accomplished", text: "Keep up to 10 plans side by side. Pick one at the top to see your status: how much of each day and the whole plan is done." },
];

const PLAN_PILLS = [
  { label: "📘 Micro exam", pct: 40, x: 60, w: 160 },
  { label: "📗 Study week", pct: 0, x: 232, w: 166 },
  { label: "📝 Term paper", pct: 15, x: 410, w: 170 },
];
const PLAN_DAYS = [["Thu", 100], ["Fri", 80], ["Sat", 35]];
const PLAN_TASKS = 25;
const PLAN_DONE = 18;

function plansScene() {
  const pills = PLAN_PILLS.map((p, i) => `
    <g class="d5-pill">
      <rect id="d5Pill${i}" x="${p.x}" y="10" width="${p.w}" height="32" rx="16" fill="#1e222b" stroke="#2a2f3a" stroke-width="1.5"/>
      <text x="${p.x + 14}" y="31" class="d-tab">${p.label}</text>
      <text id="d5PillPct${i}" x="${p.x + p.w - 14}" y="31" text-anchor="end" class="d-small">${p.pct}%</text>
    </g>`).join("");
  const rows = PLAN_DAYS.map(([d], i) => {
    const y = 172 + i * 40;
    return `<g class="d5-row">
      <text x="140" y="${y + 13}" class="d-strong">${d}</text>
      <rect x="196" y="${y + 2}" width="250" height="12" rx="6" fill="#1e222b"/>
      <rect class="d5-daybar" x="196" y="${y + 2}" width="0" height="12" rx="6" fill="#5b8cff"/>
      <text class="d5-daypct d-small" x="500" y="${y + 13}" text-anchor="end">0%</text>
    </g>`;
  }).join("");
  return `${pills}
    <g id="d5Card">
      <rect x="110" y="58" width="420" height="250" rx="14" fill="#171a21" stroke="#2a2f3a"/>
      <text x="136" y="92" class="d-strong">📗 Balanced Study Week</text>
      <text x="136" y="112" class="d-small">Your status</text>
      <rect x="136" y="124" width="368" height="12" rx="6" fill="#1e222b"/>
      <rect id="d5Prog" x="136" y="124" width="0" height="12" rx="6" fill="#35d07f"/>
      <text id="d5Count" x="504" y="156" text-anchor="end" class="d-small">0 / ${PLAN_TASKS} tasks done</text>
      ${rows}
    </g>
    <path id="d5Cursor" d="M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L18 15 Z" fill="#fff" stroke="#0f1115" stroke-width="1.5"/>`;
}

const COLORS = { study: "#ff5c7a", break: "#ffb454", wake: "#ffb454", other: "#ffb454", meal: "#35d07f", wind: "#7c6ef2" };
const GOAL = "Pass my statistics exam on Oct 10";
const DAYS = ["Thu 25", "Fri 26", "Sat 27", "Sun 28", "Mon 29"];
const TASKS = ["Read chapter 3 — probability rules", "Solve 10 practice problems", "Flashcards: key formulas", "Summary sheet for today"];

function dayCards() {
  return DAYS.map((d, i) => {
    const x = 34 + i * 118;
    const bars = [72, 56, 84].map((w, j) =>
      `<rect class="d-bar" x="${x + 12}" y="${132 + j * 22}" width="${w}" height="10" rx="5" fill="${["#ff5c7a", "#5b8cff", "#35d07f"][j]}"/>`).join("");
    return `<g class="d-card">
      <rect x="${x}" y="90" width="104" height="140" rx="12" fill="#1e222b" stroke="#2a2f3a"/>
      <text x="${x + 12}" y="116" class="d-strong">${d}</text>
      ${bars}
    </g>`;
  }).join("");
}

function dayBar() {
  const segs = buildDaySegments();
  const x0 = 40, width = 560, y = 120, h = 46;
  const start = toMin(segs[0].start);
  const total = toMin(segs[segs.length - 1].end) - start;
  const px = t => x0 + ((toMin(t) - start) / total) * width;
  const rects = segs.map(s =>
    `<rect class="d-seg" x="${px(s.start).toFixed(1)}" y="${y}" width="${Math.max(1, px(s.end) - px(s.start) - 1).toFixed(1)}" height="${h}" rx="3" fill="${COLORS[s.type]}"/>`).join("");
  const labels = segs.filter(s => s.type === "meal" || s.type === "wind").map(s => {
    const cx = (px(s.start) + px(s.end)) / 2;
    return `<text class="d-seglabel d-strong" x="${cx.toFixed(1)}" y="${y + h + 40}" text-anchor="middle" style="fill:${COLORS[s.type]}">${s.type === "wind" ? "Sleep" : s.label}</text>`;
  }).join("");
  const ticks = [8, 10, 12, 14, 16, 18, 20, 22].map(hr => {
    const x = px(`${String(hr).padStart(2, "0")}:00`).toFixed(1);
    return `<line x1="${x}" y1="${y + h + 2}" x2="${x}" y2="${y + h + 8}" stroke="#8b93a7"/>
      <text class="d-small" x="${x}" y="${y + h + 21}" text-anchor="middle">${String(hr).padStart(2, "0")}:00</text>`;
  }).join("");
  const nowX = px("14:45");
  return { svg: `
    ${rects}${ticks}${labels}
    <g id="dNow">
      <line x1="0" y1="${y - 8}" x2="0" y2="${y + h + 6}" stroke="#fff" stroke-width="2.5"/>
      <path d="M-7 ${y - 16} L7 ${y - 16} L0 ${y - 6} Z" fill="#fff"/>
      <text x="0" y="${y - 22}" text-anchor="middle" class="d-strong">NOW</text>
    </g>
    <g id="dRightNow">
      <rect x="160" y="236" width="320" height="62" rx="12" fill="#ff5c7a"/>
      <text x="320" y="262" text-anchor="middle" class="d-dark">● FOCUS TIME — HAPPENING NOW</text>
      <text x="320" y="284" text-anchor="middle" class="d-dark d-small">14:30–15:20 · Hypothesis tests</text>
    </g>`, x0, nowX };
}

function checklist() {
  const rows = TASKS.map((t, i) => {
    const y = 118 + i * 40;
    return `<g class="d-row">
      <rect class="d-box" x="176" y="${y}" width="20" height="20" rx="5" fill="#1e222b" stroke="#8b93a7" stroke-width="1.5"/>
      <path class="d-check" d="M180 ${y + 10} l5 5 l9 -10" fill="none" stroke="#06210f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <text class="d-task" x="208" y="${y + 15}">${t}</text>
    </g>`;
  }).join("");
  return `
    <rect x="150" y="26" width="340" height="286" rx="14" fill="#171a21" stroke="#2a2f3a"/>
    <text x="176" y="58" class="d-strong">Thu, Sep 25 — Today</text>
    <g id="dDone"><rect x="398" y="44" width="68" height="20" rx="10" fill="#35d07f"/><text x="432" y="58" text-anchor="middle" class="d-dark d-small">DONE ✓</text></g>
    <rect x="176" y="76" width="290" height="10" rx="5" fill="#1e222b"/>
    <rect id="dProg" x="176" y="76" width="0" height="10" rx="5" fill="#35d07f"/>
    ${rows}`;
}

function markup(bar) {
  return `
  <div class="demo-card">
    <button class="demo-close" type="button" aria-label="Close demo">✕</button>
    <div class="demo-kicker">How FocusPlan works</div>
    <svg class="demo-svg" viewBox="0 0 640 320" role="img" aria-label="Animated walkthrough of FocusPlan">
      <g id="d1">
        <g id="dTabs">
          <rect id="dTabP" x="110" y="6" width="128" height="28" rx="8" fill="#1e222b" stroke="#2a2f3a"/>
          <text x="174" y="25" text-anchor="middle" class="d-tab">✨ Personalize</text>
          <rect x="244" y="6" width="112" height="28" rx="8" fill="#1e222b" stroke="#2a2f3a"/>
          <text x="300" y="25" text-anchor="middle" class="d-tab d-muted">✅ Checklist</text>
          <rect x="362" y="6" width="104" height="28" rx="8" fill="#1e222b" stroke="#2a2f3a"/>
          <text x="414" y="25" text-anchor="middle" class="d-tab d-muted">🕒 Timeline</text>
        </g>
        <g id="dForm">
          <rect x="110" y="42" width="420" height="266" rx="14" fill="#171a21" stroke="#2a2f3a"/>
          <text x="134" y="72" class="d-label">WHAT DO YOU WANT TO ACCOMPLISH?</text>
          <rect x="134" y="82" width="372" height="56" rx="8" fill="#1e222b" stroke="#2a2f3a"/>
          <text id="dGoal" x="148" y="115" class="d-body"></text>
          <rect id="dCaret" x="148" y="101" width="2" height="18" fill="#5b8cff"/>
          <g class="d-chip"><rect x="134" y="152" width="172" height="34" rx="17" fill="#1e222b" stroke="#2a2f3a"/><text x="150" y="174" class="d-body">📅 Sep 25 → Oct 10</text></g>
          <g class="d-chip"><rect x="316" y="152" width="190" height="34" rx="17" fill="#1e222b" stroke="#35d07f"/><text x="330" y="174" class="d-body">✨ DeepSeek · cheapest</text></g>
          <g id="dGen"><rect x="134" y="222" width="372" height="46" rx="10" fill="#5b8cff"/><text x="320" y="251" text-anchor="middle" class="d-btn">Generate plan</text></g>
        </g>
        <path id="dCursor" d="M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L18 15 Z" fill="#fff" stroke="#0f1115" stroke-width="1.5"/>
      </g>
      <g id="d2">
        <circle id="dRing" cx="320" cy="160" r="40" fill="none" stroke="#a78bfa" stroke-width="3"/>
        <g id="dAI"><circle cx="320" cy="160" r="34" fill="#a78bfa"/><text x="320" y="168" text-anchor="middle" class="d-ai">AI</text></g>
        ${dayCards()}
      </g>
      <g id="d3">${bar.svg}</g>
      <g id="d4">${checklist()}</g>
      <g id="d5">${plansScene()}</g>
    </svg>
    <div class="demo-player">
      <button type="button" id="demoPlay" aria-label="Pause">⏸</button>
      <div class="demo-progress" id="demoProgress" title="Click to jump"><div class="demo-progress-fill" id="demoProgressFill"></div></div>
    </div>
    <div class="demo-caption">
      <div class="demo-dots">${STEPS.map((s, i) => `<button type="button" class="demo-dot" data-step="${i}" aria-label="Step ${i + 1}: ${s.title}"></button>`).join("")}</div>
      <h3 id="demoTitle"></h3>
      <p id="demoText"></p>
    </div>
    <div class="demo-actions">
      <button type="button" id="demoReplay">↺ Replay</button>
      <button type="button" id="demoSkip">Skip</button>
      <button type="button" id="demoExample">📘 Load example plan</button>
      <button type="button" class="btn-primary" id="demoCreate">Create my plan →</button>
    </div>
  </div>`;
}

function buildTimeline(gsap, root, bar, setStep) {
  const q = sel => root.querySelectorAll(sel);
  const one = sel => root.querySelector(sel);
  const scenes = ["#d1", "#d2", "#d3", "#d4", "#d5"].map(one);
  const goal = one("#dGoal");
  const caret = one("#dCaret");
  const typed = { n: 0 };

  gsap.set(scenes, { autoAlpha: 0 });
  gsap.set(one("#dCursor"), { x: 560, y: 300 });
  gsap.set(q(".d-check"), { strokeDasharray: 30, strokeDashoffset: 30 });
  gsap.set(one("#dNow"), { x: bar.x0 });

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  // 1 — open Personalize (same tab as in the real app), then describe the goal
  tl.addLabel("s0")
    .call(() => { setStep(0); goal.textContent = ""; typed.n = 0; caret.setAttribute("x", 148); })
    .set(one("#dTabP"), { attr: { fill: "#1e222b", stroke: "#2a2f3a" } })
    .set(one("#dForm"), { autoAlpha: 0 })
    .to(scenes[0], { autoAlpha: 1, duration: 0.4 })
    .to(one("#dCursor"), { x: 190, y: 22, duration: 0.8, ease: "power3.inOut" })
    .to(one("#dTabP"), { attr: { fill: "#171a21", stroke: "#5b8cff" }, duration: 0.15 })
    .fromTo(one("#dTabP"), { scale: 1, transformOrigin: "50% 50%" }, { scale: 0.93, duration: 0.1, yoyo: true, repeat: 1 }, "<")
    .to(one("#dForm"), { autoAlpha: 1, duration: 0.35 })
    .to(one("#dCursor"), { x: 560, y: 300, duration: 0.5 }, "<")
    .to(typed, {
      n: GOAL.length, duration: 1.6, ease: "none",
      onUpdate: () => {
        goal.textContent = GOAL.slice(0, Math.round(typed.n));
        caret.setAttribute("x", 150 + goal.getComputedTextLength());
      },
    })
    .from(q(".d-chip"), { y: 12, autoAlpha: 0, stagger: 0.15, duration: 0.4 }, "-=0.2")
    .to(one("#dCursor"), { x: 330, y: 242, duration: 0.8, ease: "power3.inOut" })
    .to(one("#dGen"), { scale: 0.94, transformOrigin: "50% 50%", duration: 0.1, yoyo: true, repeat: 1 })
    .to(scenes[0], { autoAlpha: 0, duration: 0.35 }, "+=0.3");

  // 2 — AI builds the plan
  tl.addLabel("s1")
    .call(() => setStep(1))
    .to(scenes[1], { autoAlpha: 1, duration: 0.3 })
    .from(one("#dAI"), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)" })
    .fromTo(one("#dRing"), { scale: 1, autoAlpha: 1, transformOrigin: "50% 50%" }, { scale: 1.8, autoAlpha: 0, duration: 0.8, repeat: 1 })
    .to(one("#dAI"), { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.3 }, "-=0.4")
    .from(q(".d-card"), {
      x: i => 320 - (86 + i * 118), y: 0, scale: 0.2, autoAlpha: 0, transformOrigin: "50% 50%",
      stagger: 0.12, duration: 0.55, ease: "back.out(1.4)",
    }, "-=0.2")
    .from(q(".d-bar"), { scaleX: 0, transformOrigin: "0% 50%", stagger: 0.03, duration: 0.3 }, "-=0.3")
    .to(scenes[1], { autoAlpha: 0, duration: 0.35 }, "+=0.9");

  // 3 — the day, block by block
  tl.addLabel("s2")
    .call(() => setStep(2))
    .to(scenes[2], { autoAlpha: 1, duration: 0.3 })
    .from(q(".d-seg"), { scaleY: 0, transformOrigin: "50% 100%", stagger: 0.035, duration: 0.3 })
    .from(q(".d-seglabel"), { autoAlpha: 0, y: 6, stagger: 0.1, duration: 0.3 }, "-=0.2")
    .fromTo(one("#dNow"), { x: bar.x0, autoAlpha: 0 }, { x: bar.nowX, autoAlpha: 1, duration: 1.4, ease: "power1.inOut" })
    .from(one("#dRightNow"), { y: 20, autoAlpha: 0, duration: 0.45, ease: "back.out(1.6)" })
    .to(scenes[2], { autoAlpha: 0, duration: 0.35 }, "+=1.1");

  // 4 — check it off
  tl.addLabel("s3")
    .call(() => setStep(3))
    .set(one("#dProg"), { attr: { width: 0 } })
    .to(scenes[3], { autoAlpha: 1, duration: 0.3 })
    .from(q(".d-row"), { x: -16, autoAlpha: 0, stagger: 0.1, duration: 0.35 })
    .from(one("#dDone"), { autoAlpha: 0, duration: 0.01 });
  q(".d-row").forEach((row, i) => {
    tl.to(row.querySelector(".d-box"), { attr: { fill: "#35d07f", stroke: "#35d07f" }, duration: 0.15 }, `+=${i ? 0.25 : 0.4}`)
      .to(row.querySelector(".d-check"), { strokeDashoffset: 0, duration: 0.25 }, "<")
      .to(row.querySelector(".d-task"), { attr: { fill: "#8b93a7" }, duration: 0.2 }, "<")
      .to(one("#dProg"), { attr: { width: 290 * ((i + 1) / TASKS.length) }, duration: 0.3 }, "<");
  });
  tl.fromTo(one("#dDone"), { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%" }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: "back.out(2.5)" })
    .to(scenes[3], { autoAlpha: 0, duration: 0.35 }, "+=1");

  // 5 — several plans: pick one, see its status
  const done = { n: 0 };
  const count = one("#d5Count");
  const pct1 = one("#d5PillPct1");
  tl.addLabel("s4")
    .call(() => setStep(4))
    .set(one("#d5Card"), { autoAlpha: 0 })
    .set(one("#d5Pill1"), { attr: { stroke: "#2a2f3a" } })
    .set(q(".d5-daybar"), { attr: { width: 0 } })
    .set(one("#d5Prog"), { attr: { width: 0 } })
    .set(one("#d5Cursor"), { x: 560, y: 290 })
    .call(() => { done.n = 0; count.textContent = `0 / ${PLAN_TASKS} tasks done`; pct1.textContent = "0%"; q(".d5-daypct").forEach(t => (t.textContent = "0%")); })
    .to(scenes[4], { autoAlpha: 1, duration: 0.3 })
    .from(q(".d5-pill"), { y: -10, autoAlpha: 0, stagger: 0.12, duration: 0.35 })
    .to(one("#d5Cursor"), { x: 300, y: 30, duration: 0.8, ease: "power3.inOut" })
    .to(one("#d5Pill1"), { attr: { stroke: "#5b8cff" }, duration: 0.15 })
    .fromTo(one("#d5Pill1"), { scale: 1, transformOrigin: "50% 50%" }, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 }, "<")
    .to(one("#d5Card"), { autoAlpha: 1, duration: 0.35 })
    .to(one("#d5Cursor"), { x: 560, y: 290, duration: 0.5 }, "<");
  q(".d5-daybar").forEach((bar, i) => {
    const pct = PLAN_DAYS[i][1];
    const label = q(".d5-daypct")[i];
    tl.to(bar, {
      attr: { width: 250 * pct / 100, fill: pct === 100 ? "#35d07f" : "#5b8cff" }, duration: 0.6,
      onUpdate() { label.textContent = `${Math.round(this.progress() * pct)}%${pct === 100 && this.progress() === 1 ? " ✓" : ""}`; },
    }, i ? "-=0.3" : "+=0.1");
  });
  tl.to(done, {
    n: PLAN_DONE, duration: 1, ease: "power1.out",
    onUpdate: () => {
      const n = Math.round(done.n);
      count.textContent = `${n} / ${PLAN_TASKS} tasks done`;
      pct1.textContent = `${Math.round((n / PLAN_TASKS) * 100)}%`;
    },
  }, "-=0.9")
    .to(one("#d5Prog"), { attr: { width: 368 * PLAN_DONE / PLAN_TASKS }, duration: 1, ease: "power1.out" }, "<");
  return tl;
}

// After the demo, point at the real ✨ Personalize tab so it's obvious where to start.
function spotlightPersonalize() {
  const tab = document.querySelector('.tab-btn[data-tab="personalize"]');
  if (!tab || tab.classList.contains("active")) return;
  document.querySelectorAll(".spotlight-tip").forEach(t => t.remove());
  const tip = document.createElement("div");
  tip.className = "spotlight-tip";
  tip.textContent = "👆 Create your own plan here";
  tab.style.position = "relative";
  tab.appendChild(tip);
  tab.classList.add("spotlight");
  const stop = () => {
    tab.classList.remove("spotlight");
    tip.remove();
    tab.removeEventListener("click", stop);
  };
  tab.addEventListener("click", stop);
  setTimeout(stop, 8000);
}

export async function openDemo({ onCreate, onExample, onClose } = {}) {
  if (document.querySelector(".demo-overlay")) return;
  const bar = dayBar();
  const overlay = document.createElement("div");
  overlay.className = "demo-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "How FocusPlan works");
  overlay.innerHTML = markup(bar);
  document.body.appendChild(overlay);

  const setStep = i => {
    overlay.querySelector("#demoTitle").textContent = `${i + 1} · ${STEPS[i].title}`;
    overlay.querySelector("#demoText").textContent = STEPS[i].text;
    overlay.querySelectorAll(".demo-dot").forEach((d, j) => d.classList.toggle("active", j === i));
  };
  setStep(0);

  let tl = null;
  const close = () => {
    if (tl) tl.kill();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    if (onClose) onClose();
    spotlightPersonalize();
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  overlay.querySelector(".demo-close").addEventListener("click", close);
  overlay.querySelector("#demoSkip").addEventListener("click", close);
  overlay.querySelector("#demoCreate").addEventListener("click", () => { if (onCreate) onCreate(); close(); });
  overlay.querySelector("#demoExample").addEventListener("click", () => {
    if (tl) tl.kill();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    if (onExample) onExample();
  });
  overlay.querySelector(".demo-close").focus();

  let gsap;
  try {
    const mod = await import(GSAP_URL);
    gsap = mod.gsap || mod.default;
  } catch (e) {
    // Offline: show the final scene and let the dots flip through the captions.
    overlay.querySelector("#d4").style.opacity = 1;
    ["#d1", "#d2", "#d3", "#d5"].forEach(s => (overlay.querySelector(s).style.display = "none"));
    overlay.querySelector("#demoReplay").hidden = true;
    overlay.querySelector(".demo-player").style.display = "none";
    overlay.querySelectorAll(".demo-dot").forEach(d => d.addEventListener("click", () => setStep(+d.dataset.step)));
    return;
  }
  if (!overlay.isConnected) return;

  tl = buildTimeline(gsap, overlay, bar, setStep);
  const fill = overlay.querySelector("#demoProgressFill");
  const playBtn = overlay.querySelector("#demoPlay");
  const syncPlay = () => {
    const playing = tl.isActive() || (!tl.paused() && tl.progress() < 1);
    playBtn.textContent = playing ? "⏸" : "▶";
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  };
  tl.eventCallback("onUpdate", () => { fill.style.width = `${tl.progress() * 100}%`; });
  tl.eventCallback("onComplete", syncPlay);
  playBtn.addEventListener("click", () => {
    if (tl.progress() >= 1) tl.restart();
    else tl.paused(!tl.paused());
    syncPlay();
  });
  overlay.querySelector("#demoProgress").addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    tl.progress(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))).play();
    syncPlay();
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) tl.progress(1);
  overlay.querySelector("#demoReplay").addEventListener("click", () => { tl.restart(); syncPlay(); });
  overlay.querySelectorAll(".demo-dot").forEach(d =>
    d.addEventListener("click", () => { tl.play(`s${d.dataset.step}`); syncPlay(); }));
}
