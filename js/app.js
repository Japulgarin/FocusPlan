import {
  MAX_PLANS, loadPlans, addPlan, deletePlan, loadActiveId, saveActiveId,
  loadProgress, saveProgress, loadOpen, saveOpen, loadDayPick, saveDayPick,
  loadKey, saveKey, forgetKey, loadLastForm, saveLastForm,
} from "./storage.js";
import { segmentsFor, toMin, nowMinutes, todayISO, formatDay, dateRange } from "./schedule.js";
import { PROVIDERS, PRICES_CHECKED, DEFAULT_PROVIDER, listModels, testConnection, usesServerFallback } from "./providers.js";
import { generatePlan } from "./generator.js";
import { openDemo } from "./demo.js";
import { microExample, MICRO_EXAMPLE_ID, MICRO_GOAL } from "./plans/micro.js";

const $ = id => document.getElementById(id);

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ESC[c]);
}

let plans = loadPlans();
let activeId = loadActiveId(plans);
let progress = {};
let openDays = {};
let selectedDay = 0;
let draft = null;
let draftInputs = null;

const plan = () => plans.find(p => p.id === activeId) || null;
const taskId = (dayIdx, blockIdx, taskIdx) => `${dayIdx}-${blockIdx}-${taskIdx}`;

function todayIndex(p) {
  const dates = p.days.map(d => d.date);
  const iso = todayISO();
  const idx = dates.indexOf(iso);
  if (idx !== -1) return idx;
  return iso < dates[0] ? 0 : dates.length - 1;
}

function resolveSelectedDay(p) {
  const pick = loadDayPick(p.id);
  return Number.isInteger(pick) && pick >= 0 && pick < p.days.length ? pick : todayIndex(p);
}

function loadPlanState() {
  const p = plan();
  if (!p) return;
  progress = loadProgress(p.id);
  openDays = loadOpen(p.id);
  openDays[todayIndex(p)] = true;
  selectedDay = resolveSelectedDay(p);
}

function planProgress(p) {
  const prog = p.id === activeId ? progress : loadProgress(p.id);
  let total = 0, done = 0;
  p.days.forEach((d, di) => d.blocks.forEach((b, bi) => b.tasks.forEach((t, ti) => {
    total++;
    if (prog[taskId(di, bi, ti)]) done++;
  })));
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

function findGroupIndexForBlockNum(day, blockNum) {
  return day.blocks.findIndex(b => (b.blockNums || []).includes(blockNum));
}

// { segIdx, status }: status is the live segment's type, or "upcoming" / "idle" outside the day.
function findCurrentSegment(segs) {
  const mins = nowMinutes();
  for (let i = 0; i < segs.length; i++) {
    if (mins >= toMin(segs[i].start) && mins < toMin(segs[i].end)) return { segIdx: i, status: segs[i].type };
  }
  for (let i = 0; i < segs.length; i++) {
    if (mins < toMin(segs[i].start)) return { segIdx: i, status: "upcoming" };
  }
  return { segIdx: -1, status: "idle" };
}

function segGroupTitle(day, seg) {
  if (seg.type !== "study") return seg.label;
  const gIdx = findGroupIndexForBlockNum(day, seg.blockNum);
  return gIdx >= 0 ? day.blocks[gIdx].short : "Focus block";
}

function groupTimeRange(segs, group) {
  const study = segs.filter(s => s.type === "study" && (group.blockNums || []).includes(s.blockNum));
  return study.length ? `${study[0].start}–${study[study.length - 1].end}` : "";
}

// ---------------- Header & plan switcher ----------------
function renderHeader() {
  const p = plan();
  $("planName").textContent = p ? p.name : "FocusPlan";
  const dates = p ? `${formatDay(p.startDate)} → ${formatDay(p.endDate)}` : "";
  $("planSub").textContent = !p
    ? "No plan yet. Open ✨ Personalize to create one."
    : p.goal
      ? `🎯 ${p.goal.length > 160 ? p.goal.slice(0, 157) + "…" : p.goal} · ${dates}`
      : `${p.subtitle || dates} · Check off tasks as you go — progress is saved in this browser.`;
  const { total, done, pct } = p ? planProgress(p) : { total: 0, done: 0, pct: 0 };
  $("overallBar").style.width = `${pct}%`;
  $("overallLabel").textContent = `${done} / ${total} tasks done (${pct}%)`;
}

function renderPlanBar() {
  const bar = $("planBar");
  bar.innerHTML = "";
  plans.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "plan-pill" + (p.id === activeId ? " active" : "");
    btn.innerHTML = `<span class="dot" style="background:${esc(p.color)}"></span><span>${esc(p.name)}</span><span class="pct">${planProgress(p).pct}%</span>`;
    btn.addEventListener("click", () => switchPlan(p.id));
    bar.appendChild(btn);
  });
  const add = document.createElement("button");
  add.className = "plan-pill new";
  add.textContent = `+ New plan (${plans.length}/${MAX_PLANS})`;
  add.disabled = plans.length >= MAX_PLANS;
  add.title = add.disabled ? `You have ${MAX_PLANS} plans. Delete one to make room.` : "Create a plan with AI";
  add.addEventListener("click", () => showTab("personalize"));
  bar.appendChild(add);
}

// Adds the Microeconomics example (starting today) or jumps to it if it's already loaded.
function loadExamplePlan() {
  if (plans.some(p => p.id === MICRO_EXAMPLE_ID)) return switchPlan(MICRO_EXAMPLE_ID);
  if (plans.length >= MAX_PLANS) {
    showTab("personalize");
    setMsg("genMsg", `You already have ${MAX_PLANS} plans. Delete one to load the example.`, "error");
    return;
  }
  plans = addPlan(microExample(todayISO()));
  switchPlan(MICRO_EXAMPLE_ID);
}

function useExampleGoal() {
  $("goal").value = MICRO_GOAL;
  const start = todayISO();
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + 3);
  $("startDate").value = start;
  $("endDate").value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  persistForm();
  setMsg("genMsg", "Example goal filled in (4 days from today). Add your key, test the connection, then Generate.", "info");
  $("goal").scrollIntoView({ behavior: "smooth", block: "center" });
}

function switchPlan(id) {
  activeId = id;
  saveActiveId(id);
  loadPlanState();
  showTab("checklist");
  renderAll();
}

// ---------------- Right Now panel ----------------
function renderNowPanel() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("clockDate").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const el = $("nowStatus");
  const p = plan();
  if (!p) {
    el.innerHTML = `<div class="now-status idle"><div class="tag">No plan</div><div class="range">Create one in ✨ Personalize.</div></div>`;
    return;
  }
  const day = p.days[selectedDay];
  const segs = segmentsFor(p, day);
  const { segIdx, status } = findCurrentSegment(segs);

  // Live status only makes sense for today's date; other days get a calm preview.
  if (day.date !== todayISO()) {
    const firstStudy = segs.find(s => s.type === "study");
    const future = day.date > todayISO();
    el.innerHTML = `
      <div class="now-status idle">
        <div class="tag">${future ? "📅 Coming up" : "✔ Past day"}</div>
        <div class="range">${esc(formatDay(day.date))} · ${esc(day.label)}</div>
        ${future && firstStudy ? `<div class="block-name">First block at ${esc(firstStudy.start)}: ${esc(segGroupTitle(day, firstStudy))}</div>` : ""}
      </div>`;
    return;
  }

  if (status === "study") {
    const seg = segs[segIdx];
    const gIdx = findGroupIndexForBlockNum(day, seg.blockNum);
    const group = day.blocks[gIdx];
    const items = group ? group.tasks.map((t, tIdx) =>
      `<li class="${progress[taskId(selectedDay, gIdx, tIdx)] ? "done-task" : ""}">${esc(t)}</li>`).join("") : "";
    el.innerHTML = `
      <div class="now-status active">
        <div class="tag">● Focus time — happening now</div>
        <div class="range">${esc(seg.start)}–${esc(seg.end)}</div>
        <div class="block-name">${esc(group ? group.short : "Focus block")}</div>
        <ul>${items}</ul>
      </div>`;
  } else if (["break", "meal", "wind", "other", "wake"].includes(status)) {
    const seg = segs[segIdx];
    const tag = { meal: "🍽 Meal time", wind: "🌙 Sleep / wind down", wake: "☀️ Wake up", other: "🚶 On the move" }[status] || "☕ Break";
    const next = segs.slice(segIdx + 1).find(s => s.type === "study");
    el.innerHTML = `
      <div class="now-status ${status}">
        <div class="tag">${tag} — take it</div>
        <div class="range">${esc(seg.start)}–${esc(seg.end)}${seg.label ? " · " + esc(seg.label) : ""}</div>
        ${next ? `<div class="block-name">Up next: ${esc(segGroupTitle(day, next))} (${esc(next.start)})</div>` : ""}
      </div>`;
  } else if (status === "upcoming") {
    const seg = segs[segIdx];
    el.innerHTML = `
      <div class="now-status wind">
        <div class="tag">😴 Sleep time</div>
        <div class="range">The day hasn't started yet</div>
        <div class="block-name">First up at ${esc(seg.start)}: ${esc(segGroupTitle(day, seg))}</div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="now-status wind">
        <div class="tag">😴 Sleep time</div>
        <div class="range">Today's blocks are done</div>
        <div class="block-name">Get real rest — next block starts at ${esc(segs[0].start)}</div>
      </div>`;
  }
}

// ---------------- Checklist ----------------
function blockElement(p, day, dayIdx, bIdx, { timeStr, isNow, isPast }) {
  const b = day.blocks[bIdx];
  const el = document.createElement("div");
  el.className = "block" + (isNow ? " is-now" : "") + (isPast ? " is-past" : "");
  if (isNow) el.id = "block-now";
  const groupDone = b.tasks.length > 0 && b.tasks.every((t, tIdx) => progress[taskId(dayIdx, bIdx, tIdx)]);
  el.innerHTML = `
    <div class="block-title-row">
      <div class="block-title">${esc(b.title)}${isNow ? '<span class="now-pill">NOW</span>' : ""}${!isNow && isPast && groupDone ? '<span class="done-pill">DONE</span>' : ""}</div>
      <div class="block-time">${esc(timeStr)}</div>
    </div>`;
  b.tasks.forEach((t, tIdx) => {
    const id = taskId(dayIdx, bIdx, tIdx);
    const done = !!progress[id];
    const row = document.createElement("div");
    row.className = "task" + (done ? " done" : "");
    const inputId = `chk-${p.id}-${id}`;
    row.innerHTML = `<input type="checkbox" id="${esc(inputId)}" ${done ? "checked" : ""}><label for="${esc(inputId)}">${esc(t)}</label>`;
    row.querySelector("input").addEventListener("change", e => {
      progress[id] = e.target.checked;
      saveProgress(p.id, progress);
      renderChecklist();
      renderHeader();
      renderPlanBar();
      renderNowPanel();
    });
    el.appendChild(row);
  });
  return el;
}

function renderChecklist() {
  const main = $("main");
  main.innerHTML = "";
  const p = plan();
  if (!p) {
    main.innerHTML = `<div class="card"><h3>No plans yet</h3><p class="hint" style="margin:0">Open ✨ Personalize to create a plan with AI.</p></div>`;
    return;
  }
  const mins = nowMinutes();
  const today = todayISO();
  const selSegs = segmentsFor(p, p.days[selectedDay]);
  const selIsToday = p.days[selectedDay].date === today;
  const cur = selIsToday ? findCurrentSegment(selSegs) : { segIdx: -1, status: "idle" };
  const nowGroupIdx = cur.status === "study" ? findGroupIndexForBlockNum(p.days[selectedDay], selSegs[cur.segIdx].blockNum) : -1;

  p.days.forEach((day, dayIdx) => {
    const segs = dayIdx === selectedDay ? selSegs : segmentsFor(p, day);
    let dayTotal = 0, dayDone = 0;
    day.blocks.forEach((b, bIdx) => b.tasks.forEach((t, ti) => {
      dayTotal++;
      if (progress[taskId(dayIdx, bIdx, ti)]) dayDone++;
    }));
    const pct = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;
    const isSel = dayIdx === selectedDay && selIsToday;
    const isSelNowDay = isSel && nowGroupIdx >= 0;

    const dayEl = document.createElement("div");
    dayEl.className = "day" + (openDays[dayIdx] ? " open" : "") + (isSelNowDay ? " is-now" : "");
    dayEl.id = `day-${dayIdx}`;

    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `
      <div>
        <div class="day-title">${esc(formatDay(day.date))}${day.date === today ? " — Today" : ""}</div>
        <div class="day-date">${esc(day.label)}</div>
      </div>
      <div class="day-progress-wrap">
        <div class="day-bar-wrap"><div class="day-bar" style="width:${pct}%"></div></div>
        <div class="day-pct">${pct}%</div>
        <div class="chevron">▶</div>
      </div>`;
    header.addEventListener("click", () => {
      openDays[dayIdx] = !openDays[dayIdx];
      saveOpen(p.id, openDays);
      renderChecklist();
    });

    const body = document.createElement("div");
    body.className = "day-body";
    const rendered = new Set();
    let lastGroup = -1;

    segs.forEach((seg, segIdx) => {
      if (seg.type === "study") {
        const bIdx = findGroupIndexForBlockNum(day, seg.blockNum);
        if (bIdx < 0 || bIdx === lastGroup) return;
        lastGroup = bIdx;
        rendered.add(bIdx);
        const b = day.blocks[bIdx];
        const groupSegs = segs.filter(s => s.type === "study" && b.blockNums.includes(s.blockNum));
        const isNow = isSelNowDay && bIdx === nowGroupIdx;
        const isPast = isSel && !isNow && groupSegs.length > 0 && groupSegs.every(s => toMin(s.end) <= mins);
        body.appendChild(blockElement(p, day, dayIdx, bIdx, { timeStr: groupTimeRange(segs, b), isNow, isPast }));
        return;
      }
      const isNow = isSel && cur.segIdx === segIdx && cur.status === seg.type;
      const isPast = isSel && !isNow && toMin(seg.end) <= mins;
      const rest = document.createElement("div");
      rest.className = `rest-item ${seg.type}` + (isNow ? " is-now" : "") + (isPast ? " is-past" : "");
      if (isNow) rest.id = "block-now";
      const icon = { break: "☕", meal: "🍽", wind: "🌙", wake: "☀️", other: "🚶" }[seg.type] || "•";
      rest.innerHTML = `
        <span class="rest-icon">${icon}</span>
        <span class="rest-label">${esc(seg.label)}</span>
        <span class="rest-time">${esc(seg.start)}–${esc(seg.end)}${isNow ? '<span class="now-pill">NOW</span>' : ""}</span>`;
      body.appendChild(rest);
      if (Number.isInteger(seg.taskBlock) && day.blocks[seg.taskBlock] && !rendered.has(seg.taskBlock)) {
        rendered.add(seg.taskBlock);
        body.appendChild(blockElement(p, day, dayIdx, seg.taskBlock, { timeStr: `${seg.start}–${seg.end}`, isNow, isPast }));
      }
    });

    // Any session not tied to a time slot still gets shown so its tasks can be checked off.
    day.blocks.forEach((b, bIdx) => {
      if (!rendered.has(bIdx)) body.appendChild(blockElement(p, day, dayIdx, bIdx, { timeStr: "", isNow: false, isPast: false }));
    });

    dayEl.appendChild(header);
    dayEl.appendChild(body);
    main.appendChild(dayEl);
  });
}

// ---------------- Timeline ----------------
function renderTimeline() {
  const wrap = $("timelineWrap");
  wrap.innerHTML = "";
  const p = plan();
  if (!p) return;
  const day = p.days[selectedDay];
  const segs = segmentsFor(p, day);
  const isToday = day.date === todayISO();
  const mins = isToday ? nowMinutes() : -1;
  const { segIdx: nowIdx, status } = isToday ? findCurrentSegment(segs) : { segIdx: -1, status: "idle" };
  const live = status !== "idle" && status !== "upcoming";
  const start = nowIdx >= 0 ? nowIdx : 0;
  const order = segs.map((s, i) => i).slice(start).concat(segs.map((s, i) => i).slice(0, start));
  const typeLabel = { study: "Focus block", break: "Break", meal: "Meal", wind: "Sleep / wind down", wake: "Wake up", other: "Other" };

  order.forEach(i => {
    const seg = segs[i];
    const isNow = live && i === nowIdx;
    const isPast = toMin(seg.end) <= mins;
    const row = document.createElement("div");
    row.className = `tl-row ${seg.type}` + (isNow ? " is-now" : "") + (isPast && !isNow ? " is-past" : "");
    row.innerHTML = `
      <div class="tl-time">${esc(seg.start)}<br>${esc(seg.end)}</div>
      <div class="tl-line-wrap"><div class="tl-line"></div><div class="tl-dot"></div></div>
      <div class="tl-content">
        <div class="tl-card">
          <div class="tl-type">${typeLabel[seg.type] || esc(seg.type)}${isNow ? " · NOW" : ""}</div>
          <div class="tl-label">${esc(segGroupTitle(day, seg))}</div>
        </div>
      </div>`;
    wrap.appendChild(row);
  });
}

// ---------------- Day selector ----------------
function buildDaySelect() {
  const sel = $("daySelect");
  const p = plan();
  if (!p) {
    sel.innerHTML = "";
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  const today = todayISO();
  sel.innerHTML = p.days.map((d, i) => `<option value="${i}">${esc(formatDay(d.date))}${d.date === today ? " — Today" : ""}</option>`).join("");
  sel.value = String(selectedDay);
}

// Keeps the selected day on the real calendar date (unless the user picked another day today).
function syncSelectedDay() {
  const p = plan();
  if (p) selectedDay = resolveSelectedDay(p);
}

function renderAll() {
  syncSelectedDay();
  renderPlanBar();
  renderHeader();
  buildDaySelect();
  renderChecklist();
  renderTimeline();
  renderNowPanel();
}

// ---------------- Tabs ----------------
function showTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  ["checklist", "timeline", "personalize"].forEach(t => $(`panel-${t}`).classList.toggle("active", t === name));
}

// ---------------- Personalize ----------------
function setMsg(id, text, kind = "info", spinning = false) {
  const el = $(id);
  el.className = `msg ${kind}`;
  el.innerHTML = text ? `${spinning ? '<span class="spinner"></span>' : ""}${esc(text)}` : "";
}

function formValues() {
  return {
    provider: $("provider").value,
    key: $("apiKey").value.trim(),
    model: $("model").value.trim(),
    goal: $("goal").value,
    startDate: $("startDate").value,
    endDate: $("endDate").value,
    template: {
      wake: $("wake").value || "08:00",
      sleep: $("sleep").value || "22:00",
      blockMin: Math.min(120, Math.max(25, parseInt($("blockMin").value, 10) || 50)),
      breakMin: Math.min(30, Math.max(5, parseInt($("breakMin").value, 10) || 10)),
    },
  };
}

function persistForm() {
  const v = formValues();
  const { key, ...rest } = v;
  saveLastForm(rest);
  if ($("rememberKey").checked && key) saveKey(v.provider, key);
}

function fillModelSelect(models) {
  const sel = $("modelSelect");
  sel.innerHTML = `<option value="">— choose a model —</option>` +
    models.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join("");
  const current = $("model").value;
  if (models.some(m => m.id === current)) sel.value = current;
}

function updateModelHint() {
  const provider = $("provider").value;
  const model = $("model").value.trim();
  const info = PROVIDERS[provider];
  let hint = provider === "openrouter"
    ? "Recent OpenRouter models only (no “pro” or premium models), free and cheapest first, with live prices."
    : `Recent, low-cost ${info.label} models only, cheapest first (prices checked ${PRICES_CHECKED}). “Load models” keeps the ones your key can use.`;
  if (usesServerFallback(provider, model)) {
    hint += " · For this model FocusPlan turns on Anthropic's server-side fallback: if Claude declines a request, it's retried on another Claude model automatically.";
  }
  $("modelHint").textContent = hint;
}

function onProviderChange() {
  const provider = $("provider").value;
  const info = PROVIDERS[provider];
  const saved = loadKey(provider);
  setMsg("testMsg", "");
  $("apiKey").value = saved;
  $("rememberKey").checked = !!saved;
  $("keyHint").innerHTML = `Environment variable name: <code>${esc(info.envVar)}</code> · <a href="${esc(info.keyUrl)}" target="_blank" rel="noopener noreferrer">Get an API key</a>`;
  fillModelSelect(info.presets);
  $("model").value = info.defaultModel;
  if (info.presets.some(m => m.id === info.defaultModel)) $("modelSelect").value = info.defaultModel;
  updateModelHint();
  if (provider === "openrouter") loadModelList();
}

async function loadModelList() {
  const provider = $("provider").value;
  const key = $("apiKey").value.trim();
  if (!key && provider !== "openrouter") {
    setMsg("genMsg", "Paste your API key first, then load models.", "error");
    return;
  }
  $("loadModels").disabled = true;
  setMsg("genMsg", `Loading models from ${PROVIDERS[provider].label}…`, "info", true);
  try {
    const models = await listModels(provider, key);
    if ($("provider").value !== provider) return;
    fillModelSelect(models.length ? models : PROVIDERS[provider].presets);
    if (!$("model").value && models.length) {
      $("model").value = models[0].id;
      $("modelSelect").value = models[0].id;
    }
    setMsg("genMsg", `${models.length} models loaded, free and cheapest first.`, "info");
  } catch (e) {
    setMsg("genMsg", e.message, "error");
  } finally {
    $("loadModels").disabled = false;
  }
}

function usageLine(u) {
  if (!u) return "";
  const n = x => x.toLocaleString();
  let cost = "";
  if (u.cost) {
    const f = x => (x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(3)}`);
    cost = u.cost.high > u.cost.low ? ` · cost ≈ ${f(u.cost.low)}–${f(u.cost.high)}` : ` · cost ≈ ${f(u.cost.low)}`;
  }
  return ` · ${n(u.input)} input + ${n(u.output)} output tokens${cost} · ${u.seconds}s`;
}

function renderPreview() {
  if (!draft) {
    $("previewCard").hidden = true;
    return;
  }
  $("previewCard").hidden = false;
  $("previewName").textContent = draft.name;
  $("previewSub").textContent = `${draft.subtitle} · ${draft.days.length} days${usageLine(draft.usage)}`;
  $("previewBody").innerHTML = draft.days.map(d => `
    <div class="preview-day">
      <h4>${esc(formatDay(d.date))}<span>${esc(d.label)}</span></h4>
      ${d.blocks.map(b => `
        <div class="preview-block"><b>${esc(b.title)}</b>
          <ul>${b.tasks.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
  $("savePlan").disabled = plans.length >= MAX_PLANS;
  setMsg("saveMsg", plans.length >= MAX_PLANS ? `You already have ${MAX_PLANS} plans. Delete one before saving.` : "", "error");
}

async function runGenerate(inputs) {
  const btns = ["generateBtn", "regenPlan"].map($);
  btns.forEach(b => (b.disabled = true));
  const days = inputs.startDate && inputs.endDate ? dateRange(inputs.startDate, inputs.endDate).length : 0;
  setMsg("genMsg", `Generating a ${days}-day plan with ${inputs.model}… long plans can take a minute or two.`, "info", true);
  try {
    draft = await generatePlan({ ...inputs, colorIndex: plans.length });
    draftInputs = inputs;
    setMsg("genMsg", "Plan ready. Check the preview below, then save it.", "info");
    renderPreview();
    $("previewCard").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    setMsg("genMsg", e.message || "Something went wrong.", "error");
  } finally {
    btns.forEach(b => (b.disabled = false));
  }
}

function initPersonalize() {
  const provSel = $("provider");
  provSel.innerHTML = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join("");

  const last = loadLastForm();
  provSel.value = last.provider && PROVIDERS[last.provider] ? last.provider : DEFAULT_PROVIDER;
  onProviderChange();
  if (last.model) $("model").value = last.model;
  if (last.goal) $("goal").value = last.goal;
  const today = todayISO();
  $("startDate").value = last.startDate && last.startDate >= today ? last.startDate : today;
  if (last.endDate && last.endDate >= $("startDate").value) {
    $("endDate").value = last.endDate;
  } else {
    const d = new Date(`${$("startDate").value}T12:00:00`);
    d.setDate(d.getDate() + 6);
    $("endDate").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (last.template) {
    $("wake").value = last.template.wake || "08:00";
    $("sleep").value = last.template.sleep || "22:00";
    $("blockMin").value = last.template.blockMin || 50;
    $("breakMin").value = last.template.breakMin || 10;
  }
  updateModelHint();

  provSel.addEventListener("change", () => { onProviderChange(); persistForm(); });
  $("modelSelect").addEventListener("change", e => {
    if (e.target.value) $("model").value = e.target.value;
    updateModelHint();
    persistForm();
  });
  $("model").addEventListener("input", updateModelHint);
  ["goal", "startDate", "endDate", "wake", "sleep", "blockMin", "breakMin", "model"].forEach(id =>
    $(id).addEventListener("change", persistForm));

  $("rememberKey").addEventListener("change", e => {
    const provider = $("provider").value;
    if (e.target.checked && $("apiKey").value.trim()) saveKey(provider, $("apiKey").value.trim());
    if (!e.target.checked) forgetKey(provider);
  });
  $("apiKey").addEventListener("change", () => {
    if ($("rememberKey").checked && $("apiKey").value.trim()) saveKey($("provider").value, $("apiKey").value.trim());
  });
  $("forgetKey").addEventListener("click", () => {
    forgetKey($("provider").value);
    $("apiKey").value = "";
    $("rememberKey").checked = false;
    setMsg("genMsg", "Key removed from this browser.", "info");
  });

  $("loadModels").addEventListener("click", loadModelList);
  $("loadExample").addEventListener("click", loadExamplePlan);
  $("useExampleGoal").addEventListener("click", useExampleGoal);
  $("goalExampleBtn").addEventListener("click", useExampleGoal);

  $("testBtn").addEventListener("click", async () => {
    const { provider, key, model } = formValues();
    if (!key) return setMsg("testMsg", `Paste your ${PROVIDERS[provider].label} key first (${PROVIDERS[provider].envVar}).`, "error");
    if (!model) return setMsg("testMsg", "Pick a model first.", "error");
    persistForm();
    $("testBtn").disabled = true;
    setMsg("testMsg", `Sending “hi” to ${PROVIDERS[provider].label} · ${model}…`, "info", true);
    try {
      const { reply, ms } = await testConnection(provider, key, model);
      setMsg("testMsg", `✅ Connected to ${PROVIDERS[provider].label} · ${model} answered in ${(ms / 1000).toFixed(1)}s: “${reply}”`, "ok");
    } catch (e) {
      setMsg("testMsg", `❌ Not connected — ${e.message}`, "error");
    } finally {
      $("testBtn").disabled = false;
    }
  });

  $("generateBtn").addEventListener("click", () => {
    persistForm();
    runGenerate(formValues());
  });
  $("regenPlan").addEventListener("click", () => {
    if (draftInputs) runGenerate(draftInputs);
  });
  $("discardPlan").addEventListener("click", () => {
    draft = null;
    draftInputs = null;
    renderPreview();
    setMsg("genMsg", "");
  });
  $("savePlan").addEventListener("click", () => {
    if (!draft) return;
    try {
      plans = addPlan(draft);
    } catch (e) {
      setMsg("saveMsg", e.message, "error");
      return;
    }
    const id = draft.id;
    draft = null;
    draftInputs = null;
    renderPreview();
    setMsg("genMsg", "");
    switchPlan(id);
  });
}

// ---------------- Footer & wiring ----------------
$("daySelect").addEventListener("change", e => {
  const p = plan();
  if (!p) return;
  selectedDay = parseInt(e.target.value, 10);
  saveDayPick(p.id, selectedDay);
  renderAll();
});

document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

const startDemo = () => openDemo({
  onCreate: () => {
    showTab("personalize");
    $("goal").focus();
  },
  onExample: loadExamplePlan,
});
$("howItWorks").addEventListener("click", startDemo);

$("expandAll").addEventListener("click", () => {
  const p = plan();
  if (!p) return;
  p.days.forEach((_, i) => (openDays[i] = true));
  saveOpen(p.id, openDays);
  renderChecklist();
});
$("collapseAll").addEventListener("click", () => {
  const p = plan();
  if (!p) return;
  p.days.forEach((_, i) => (openDays[i] = false));
  saveOpen(p.id, openDays);
  renderChecklist();
});
$("resetAll").addEventListener("click", () => {
  const p = plan();
  if (!p || !confirm(`Reset all checked tasks in "${p.name}"?`)) return;
  progress = {};
  saveProgress(p.id, progress);
  renderAll();
});
$("deletePlan").addEventListener("click", () => {
  const p = plan();
  if (!p || !confirm(`Delete "${p.name}" and its progress? This can't be undone.`)) return;
  plans = deletePlan(p.id);
  activeId = loadActiveId(plans);
  if (activeId) saveActiveId(activeId);
  loadPlanState();
  renderAll();
  renderPreview();
});
$("jumpBtn").addEventListener("click", () => {
  const p = plan();
  if (!p) return;
  showTab("checklist");
  openDays[selectedDay] = true;
  saveOpen(p.id, openDays);
  renderChecklist();
  const target = $("block-now") || $(`day-${selectedDay}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
});

loadPlanState();
initPersonalize();
renderAll();
startDemo();
setInterval(renderNowPanel, 1000);
setInterval(renderAll, 30000);
