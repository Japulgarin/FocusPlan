import { B471_PLAN } from "./plans/b471.js";
import { todayISO } from "./schedule.js";

export const MAX_PLANS = 5;
const BUILTINS = { [B471_PLAN.id]: B471_PLAN };

const K = {
  plans: "focusplan:plans",
  active: "focusplan:active",
  progress: id => `focusplan:progress:${id}`,
  open: id => `focusplan:open:${id}`,
  daySel: id => `focusplan:daysel:${id}`,
  key: provider => `focusplan:key:${provider}`,
  lastForm: "focusplan:lastform",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function remove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

// Built-in plans are stored as {id, builtin: true} and resolved from code, so edits to the
// example plan ship with the app instead of being frozen in the user's browser.
export function loadPlans() {
  let stored = read(K.plans, null);
  if (!Array.isArray(stored)) {
    stored = [{ id: B471_PLAN.id, builtin: true }];
    write(K.plans, stored);
    importLegacyProgress();
  }
  return stored.map(p => (p.builtin ? BUILTINS[p.id] : p)).filter(Boolean);
}

function savePlanList(plans) {
  write(K.plans, plans.map(p => (p.source === "builtin" ? { id: p.id, builtin: true } : p)));
}

export function addPlan(plan) {
  const plans = loadPlans();
  if (plans.length >= MAX_PLANS) throw new Error(`You already have ${MAX_PLANS} plans. Delete one first.`);
  plans.push(plan);
  savePlanList(plans);
  return plans;
}

export function deletePlan(id) {
  const plans = loadPlans().filter(p => p.id !== id);
  savePlanList(plans);
  [K.progress(id), K.open(id), K.daySel(id)].forEach(remove);
  return plans;
}

export function loadActiveId(plans) {
  const id = read(K.active, null);
  return plans.some(p => p.id === id) ? id : (plans[0] && plans[0].id);
}

export function saveActiveId(id) { write(K.active, id); }

export function loadProgress(id) { return read(K.progress(id), {}); }
export function saveProgress(id, progress) { write(K.progress(id), progress); }

export function loadOpen(id) { return read(K.open(id), {}); }
export function saveOpen(id, open) { write(K.open(id), open); }

// A manual day pick is only honored on the real day it was made; afterwards the app
// follows the calendar again.
export function loadDayPick(id) {
  const v = read(K.daySel(id), null);
  return v && v.setOn === todayISO() ? v.idx : null;
}
export function saveDayPick(id, idx) { write(K.daySel(id), { idx, setOn: todayISO() }); }

export function loadKey(provider) { return read(K.key(provider), ""); }
export function saveKey(provider, key) { write(K.key(provider), key); }
export function forgetKey(provider) { remove(K.key(provider)); }

export function demoSeen() { return read("focusplan:demoSeen", false) === true; }
export function markDemoSeen() { write("focusplan:demoSeen", true); }

export function loadLastForm() { return read(K.lastForm, {}); }
export function saveLastForm(form) { write(K.lastForm, form); }

// Carries over progress from the original single-plan exam app when it ran on the same origin.
function importLegacyProgress() {
  const legacy = read("compstrat-checklist-v1", null);
  if (legacy && typeof legacy === "object") write(K.progress(B471_PLAN.id), legacy);
  const legacyOpen = read("compstrat-open-days-v1", null);
  if (legacyOpen && typeof legacyOpen === "object") write(K.open(B471_PLAN.id), legacyOpen);
}
