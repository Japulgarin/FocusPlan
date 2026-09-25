import {
  MAX_PLANS, loadPlans, addPlan, deletePlan, loadActiveId, saveActiveId,
  loadProgress, saveProgress, loadOpen, saveOpen, loadDayPick, saveDayPick,
  loadKey, saveKey, forgetKey, loadLastForm, saveLastForm,
} from "./storage.js";
import { segmentsFor, toMin, nowMinutes, todayISO, formatDay, formatShort, dateRange, addDays } from "./schedule.js";
import { PROVIDERS, PRICES_CHECKED, DEFAULT_PROVIDER, listModels, testConnection } from "./providers.js";
import { generatePlan } from "./generator.js";
import { openDemo } from "./demo.js";
import { EXAMPLE_PLANS, PROMPT_CHIPS, instantiateExample } from "./plans/examples.js";

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
// Examples loaded before plans had icons fall back to the example's own icon.
const iconOf = p => p.icon || EXAMPLE_PLANS.find(d => d.id === p.id)?.emoji || "";
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
  $("planName").innerHTML = p
    ? `<span class="title-dates">${esc(formatShort(p.startDate))} → ${esc(formatShort(p.endDate))}</span> ${esc(iconOf(p))} ${esc(p.name)}`
    : "FocusPlan";
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
    const removable = p.source === "example";
    const mark = iconOf(p) ? `<span class="icon">${esc(iconOf(p))}</span>` : `<span class="dot" style="background:${esc(p.color)}"></span>`;
    btn.innerHTML = `${mark}<span class="pill-date">${esc(formatShort(p.startDate))}</span><span>${esc(p.name)}</span><span class="pct">${planProgress(p).pct}%</span>` +
      (removable ? `<span class="x" role="button" title="Remove this example" aria-label="Remove ${esc(p.name)}">✕</span>` : "");
    btn.addEventListener("click", e => {
      if (e.target.classList.contains("x")) return removePlan(p.id);
      switchPlan(p.id);
    });
    bar.appendChild(btn);
  });
  const add = document.createElement("button");
  add.className = "plan-pill new";
  add.textContent = `+ New plan (${plans.length}/${MAX_PLANS})`;
  add.disabled = plans.length >= MAX_PLANS;
  add.title = add.disabled ? `You have ${MAX_PLANS} plans. Delete one to make room.` : "Create a plan with AI";
  add.addEventListener("click", () => showTab("personalize"));
  bar.appendChild(add);

  EXAMPLE_PLANS.filter(def => !plans.some(p => p.id === def.id)).forEach(def => {
    const ex = document.createElement("button");
    ex.className = "plan-pill example";
    ex.textContent = `${def.emoji} + ${def.label} example`;
    ex.title = `Load a ready-made plan: ${def.summary}. Starts today.`;
    ex.disabled = plans.length >= MAX_PLANS;
    ex.addEventListener("click", () => loadExample(def.id));
    bar.appendChild(ex);
  });
}

// Adds an example plan starting today, or jumps to it if it's already loaded.
function loadExample(id) {
  if (plans.some(p => p.id === id)) return switchPlan(id);
  if (plans.length >= MAX_PLANS) {
    showTab("personalize");
    setMsg("genMsg", `You already have ${MAX_PLANS} plans. Delete one to load an example.`, "error");
    return;
  }
  const def = EXAMPLE_PLANS.find(d => d.id === id);
  plans = addPlan(instantiateExample(def, todayISO()));
  switchPlan(id);
}

// Examples can be re-added any time, so the ✕ removes them without a confirmation dialog.
function removePlan(id) {
  plans = deletePlan(id);
  if (activeId === id) {
    activeId = loadActiveId(plans);
    if (activeId) saveActiveId(activeId);
    loadPlanState();
  }
  renderAll();
}

// The picked chip's icon becomes the plan's icon, until the goal text is changed by hand.
function markChip(icon) {
  $("planIcon").value = icon;
  document.querySelectorAll("#promptChips .chip").forEach(b =>
    b.classList.toggle("active", PROMPT_CHIPS[+b.dataset.chip].emoji === icon));
}

function usePromptChip(chip) {
  $("goal").value = chip.goal;
  markChip(chip.emoji);
  const start = $("startDate").value || todayISO();
  $("startDate").value = start;
  $("endDate").value = addDays(start, chip.days - 1);
  $("wake").value = chip.template.wake;
  $("sleep").value = chip.template.sleep;
  $("blockMin").value = chip.template.blockMin;
  $("breakMin").value = chip.template.breakMin;
  persistForm();
  setMsg("genMsg", `${chip.emoji} ${chip.label} example filled in: ${chip.days} days, ${chip.template.wake}–${chip.template.sleep}. Edit anything, then Generate.`, "info");
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
    icon: $("planIcon").value,
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

// Keys are never part of the saved form; they're only stored through the explicit Save buttons.
function persistForm() {
  const form = formValues();
  delete form.key;
  saveLastForm(form);
}

function fillModelSelect(models, keep = $("model").value) {
  const sel = $("modelSelect");
  sel.innerHTML = models.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join("");
  sel.value = models.some(m => m.id === keep) ? keep : (models[0] ? models[0].id : "");
  $("model").value = sel.value;
}

function providerOptions() {
  const current = $("provider").value;
  $("provider").innerHTML = Object.entries(PROVIDERS).map(([id, p]) =>
    `<option value="${id}">${esc(p.label)}${loadKey(id) ? " — ✓ key saved" : ""}</option>`).join("");
  if (current) $("provider").value = current;
}

function refreshKeyUI() {
  const provider = $("provider").value;
  const info = PROVIDERS[provider];
  $("apiKey").value = loadKey(provider);
  $("apiKey").placeholder = `Paste your ${info.label} key`;
  $("keyHint").innerHTML = `${loadKey(provider) ? "✓ Saved in this browser · " : ""}Environment variable name: <code>${esc(info.envVar)}</code> · <a href="${esc(info.keyUrl)}" target="_blank" rel="noopener noreferrer">Get an API key</a>`;
}

function onProviderChange() {
  const provider = $("provider").value;
  const info = PROVIDERS[provider];
  setMsg("testMsg", "");
  refreshKeyUI();
  $("modelSelect").title = provider === "openrouter"
    ? "Recent OpenRouter models only, free and cheapest first, live prices"
    : `Recent, low-cost models only, cheapest first (prices checked ${PRICES_CHECKED})`;
  fillModelSelect(info.presets, info.defaultModel);
  if (provider === "openrouter") loadModelList();
}

async function loadModelList() {
  const provider = $("provider").value;
  const key = $("apiKey").value.trim();
  if (!key && provider !== "openrouter") {
    setMsg("testMsg", "Paste your API key first, then press ↻ to check which models it can use.", "error");
    return;
  }
  $("loadModels").disabled = true;
  setMsg("testMsg", `Loading models from ${PROVIDERS[provider].label}…`, "info", true);
  try {
    const models = await listModels(provider, key);
    if ($("provider").value !== provider) return;
    fillModelSelect(models.length ? models : PROVIDERS[provider].presets);
    setMsg("testMsg", `${models.length} models available, cheapest first.`, "info");
  } catch (e) {
    setMsg("testMsg", e.message, "error");
  } finally {
    $("loadModels").disabled = false;
  }
}

// Saving or forgetting a key only touches key-related UI, never the chosen model.
function afterKeysChanged() {
  providerOptions();
  refreshKeyUI();
  if (!$("keyManager").hidden) renderKeyManager();
}

// One compact row: pick a provider, paste its key, save or forget it.
let kmProvider = null;
function renderKeyManager() {
  const box = $("keyManager");
  kmProvider = kmProvider || $("provider").value;
  const saved = !!loadKey(kmProvider);
  box.innerHTML = `
    <div class="row">
      <select id="kmProvider" aria-label="Provider">${Object.entries(PROVIDERS).map(([id, p]) =>
        `<option value="${id}">${esc(p.label)}${loadKey(id) ? " ✓" : ""}</option>`).join("")}</select>
      <input type="password" id="kmKey" autocomplete="off" spellcheck="false"
        placeholder="${saved ? "✓ Saved — paste to replace" : `Paste ${esc(PROVIDERS[kmProvider].envVar)}`}">
      <button type="button" id="kmSave">💾 Save</button>
      <button type="button" id="kmForget" ${saved ? "" : "disabled"}>Forget</button>
    </div>
    <p class="key-note">🔒 Saved only in this browser. Sent only to that provider when you test or generate; never logged, never in the code or on GitHub.</p>`;
  $("kmProvider").value = kmProvider;
  $("kmProvider").addEventListener("change", e => { kmProvider = e.target.value; renderKeyManager(); });
  $("kmSave").addEventListener("click", () => {
    const v = $("kmKey").value.trim();
    if (!v) return setMsg("testMsg", `Paste a ${PROVIDERS[kmProvider].label} key first.`, "error");
    saveKey(kmProvider, v);
    afterKeysChanged();
    setMsg("testMsg", `💾 ${PROVIDERS[kmProvider].label} key saved in this browser.`, "ok");
  });
  $("kmForget").addEventListener("click", () => {
    forgetKey(kmProvider);
    afterKeysChanged();
    setMsg("testMsg", `${PROVIDERS[kmProvider].label} key removed from this browser.`, "info");
  });
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
  $("previewName").textContent = `${draft.icon} ${draft.name}`;
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

// Live step list shown while a plan is generated, so it's clear what's happening and how far along it is.
function renderProgress(s) {
  const secs = Math.floor((Date.now() - s.started) / 1000);
  const order = ["schedule", "ask", "writing", "check"];
  const at = order.indexOf(s.stage);
  const state = i => (i < at ? "done" : i === at ? "now" : "todo");
  const mark = st => (st === "done" ? "✓" : st === "now" ? '<span class="spinner"></span>' : "○");
  const who = `${esc(PROVIDERS[s.provider].label)} · ${esc(s.model)}`;
  const steps = [
    `Schedule ready: ${s.days} days × ${s.blocks} focus blocks, with breaks, meals and sleep`,
    at > 1 ? `Sent your goal to ${who}` : `Sending your goal to ${who} and waiting for the first words…`,
    s.stage === "writing"
      ? `Writing your plan: <b>day ${s.day} of ${s.days}</b> · ${s.chars.toLocaleString()} characters so far`
      : "Writing your plan day by day",
    "Checking that every block has concrete tasks",
  ];
  const pct = s.stage === "check" ? 100 : s.stage === "writing" ? Math.round(((s.day - 0.5) / s.days) * 95) : at * 3;
  $("genMsg").className = "msg info";
  $("genMsg").innerHTML = `
    <div class="gen-head"><b>Creating your plan</b><span>⏱ ${secs}s</span></div>
    <div class="gen-bar"><div style="width:${pct}%"></div></div>
    <ul class="gen-steps">${steps.map((t, i) => `<li class="${state(i)}">${mark(state(i))} ${t}</li>`).join("")}</ul>
    ${s.retry ? `<div class="gen-note">↻ ${esc(s.retry)}</div>` : ""}`;
}

async function runGenerate(inputs) {
  const btns = ["generateBtn", "regenPlan"].map($);
  btns.forEach(b => (b.disabled = true));
  const days = inputs.startDate && inputs.endDate ? dateRange(inputs.startDate, inputs.endDate).length : 0;
  const s = { stage: "schedule", started: Date.now(), provider: inputs.provider, model: inputs.model, days, blocks: 0, day: 1, chars: 0, retry: "" };
  const tick = setInterval(() => renderProgress(s), 500);
  try {
    draft = await generatePlan({
      ...inputs,
      colorIndex: plans.length,
      onProgress: p => {
        if (p.stage === "retry") s.retry = p.reason;
        else Object.assign(s, p);
        renderProgress(s);
      },
    });
    draftInputs = inputs;
    setMsg("genMsg", `✓ Plan ready in ${Math.round((Date.now() - s.started) / 1000)}s. Check the preview below, then save it.`, "ok");
    renderPreview();
    $("previewCard").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    setMsg("genMsg", e.message || "Something went wrong.", "error");
  } finally {
    clearInterval(tick);
    btns.forEach(b => (b.disabled = false));
  }
}

function initPersonalize() {
  const provSel = $("provider");
  const last = loadLastForm();
  providerOptions();
  provSel.value = last.provider && PROVIDERS[last.provider] ? last.provider : DEFAULT_PROVIDER;
  onProviderChange();
  if (last.model && [...$("modelSelect").options].some(o => o.value === last.model)) {
    $("modelSelect").value = last.model;
    $("model").value = last.model;
  }
  if (last.goal) $("goal").value = last.goal;

  $("promptChips").innerHTML = `<span class="hint" style="margin:0;align-self:center">Examples:</span>` +
    PROMPT_CHIPS.map((c, i) => `<button type="button" class="chip" data-chip="${i}">${c.emoji} ${esc(c.label)}</button>`).join("");
  $("promptChips").querySelectorAll("[data-chip]").forEach(b =>
    b.addEventListener("click", () => usePromptChip(PROMPT_CHIPS[+b.dataset.chip])));
  const chipGoal = PROMPT_CHIPS.find(c => c.emoji === last.icon)?.goal;
  if (chipGoal && last.goal === chipGoal) markChip(last.icon);
  $("goal").addEventListener("input", () => {
    const chip = PROMPT_CHIPS.find(c => c.emoji === $("planIcon").value);
    if (chip && $("goal").value !== chip.goal) markChip("");
  });
  const today = todayISO();
  $("startDate").value = last.startDate && last.startDate >= today ? last.startDate : today;
  $("endDate").value = last.endDate && last.endDate >= $("startDate").value ? last.endDate : addDays($("startDate").value, 6);
  if (last.template) {
    $("wake").value = last.template.wake || "08:00";
    $("sleep").value = last.template.sleep || "22:00";
    $("blockMin").value = last.template.blockMin || 50;
    $("breakMin").value = last.template.breakMin || 10;
  }
  provSel.addEventListener("change", () => { onProviderChange(); persistForm(); });
  $("modelSelect").addEventListener("change", e => {
    $("model").value = e.target.value;
    persistForm();
  });
  ["goal", "startDate", "endDate", "wake", "sleep", "blockMin", "breakMin"].forEach(id =>
    $(id).addEventListener("change", persistForm));

  $("saveKey").addEventListener("click", () => {
    const { provider, key } = formValues();
    if (!key) return setMsg("testMsg", `Paste your ${PROVIDERS[provider].label} key first.`, "error");
    saveKey(provider, key);
    afterKeysChanged();
    setMsg("testMsg", `💾 ${PROVIDERS[provider].label} key saved in this browser. Press 🔌 Test to check it.`, "ok");
  });
  $("toggleKeys").addEventListener("click", () => {
    const box = $("keyManager");
    box.hidden = !box.hidden;
    $("toggleKeys").setAttribute("aria-expanded", String(!box.hidden));
    if (!box.hidden) renderKeyManager();
  });

  $("loadModels").addEventListener("click", loadModelList);

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
  onExample: () => loadExample(EXAMPLE_PLANS[0].id),
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
  removePlan(p.id);
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
