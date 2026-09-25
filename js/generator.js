import { generate, estimateCost } from "./providers.js";
import { countStudyBlocks, dateRange, formatDay } from "./schedule.js";

export const MAX_DAYS = 31;
const PALETTE = ["#35d07f", "#ffb454", "#ff5c7a", "#a78bfa", "#2dd4bf", "#5b8cff"];

const STR = { type: "string" };
export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "icon", "days"],
  properties: {
    name: STR,
    icon: STR,
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "label", "blocks"],
        properties: {
          date: STR,
          label: STR,
          blocks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["short", "blockNums", "tasks"],
              properties: {
                short: STR,
                blockNums: { type: "array", items: { type: "integer" } },
                tasks: { type: "array", items: STR },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are the planning assistant inside FocusPlan, a focus-schedule app. You turn a person's goal into a realistic, intense but sustainable day-by-day checklist that someone can follow block by block without thinking about what to do next. The app has already scheduled wake-up, breaks, meals and sleep; you only decide what each focus block is for and what gets checked off.

Plan like an experienced tutor or coach:
- Cover every topic the person names, giving more time to the ones they say they're weak at and to the ones that usually carry the most weight.
- Mix learning with doing: after new material, schedule practice (problems, exercises, drafts) on it the same day or the next.
- Build in active recall and spaced review: revisit earlier topics briefly on later days instead of only once.
- Tasks must be concrete and checkable, with a number or an output where possible, e.g. "Solve 6 elasticity problems", "Write a 1-page summary sheet on monopoly", "Redo yesterday's mistakes without notes". Never write vague tasks like "study X" or "review notes".

Reply with a single JSON object and nothing else.`;

function buildUserPrompt({ goal, dates, n, blockMin }) {
  const dateList = dates.map(d => `${d} (${formatDay(d)})`).join("\n");
  return `<goal>
${goal}
</goal>

Plan these ${dates.length} dates, one "days" entry per date, in this order, using the exact date string:
${dateList}

Each day has exactly ${n} focus blocks of about ${blockMin} minutes, numbered 1 to ${n}.

How to fill it in:
- Split each day's blocks into sessions of 1–4 consecutive blocks. Each session is one item in "blocks" with consecutive "blockNums"; across the day, every number from 1 to ${n} is used exactly once.
- "short": the session's topic in 2–6 words.
- "tasks": 2–4 short, concrete, checkable actions, each under about 12 words.
- "label": a few words summing up the day's focus.
- "name": a short plan name, at most 6 words, saying what the plan is for.
- "icon": one emoji that fits the kind of goal (e.g. 📘 exam, 💼 work, 🗣️ language, 📝 writing, 🏃 fitness).
- Sequence the work: new material first, then practice. Use roughly the last quarter of the days for mixed review, a timed practice run under real conditions, and fixing weak spots.
- If the goal mentions an exam, presentation or deadline on the last date, make that day light: a short confidence review of summary sheets in the morning and no new material.

Return JSON only, shaped as {"name": ..., "icon": ..., "days": [{"date", "label", "blocks": [{"short", "blockNums", "tasks"}]}]}.`;
}

function str(v, max) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function nameFromGoal(goal) {
  const first = goal.trim().split(/[.!?\n]/)[0].trim();
  return first.length > 48 ? `${first.slice(0, 45).trim()}…` : first || "My focus plan";
}

// First character of the string if it's an emoji, otherwise "" (keeps letters or text out of icons).
export function pickIcon(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  const first = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)[Symbol.iterator]().next().value.segment;
  return /\p{Extended_Pictographic}/u.test(first) ? first : "";
}

function rangeLabel(nums) {
  return nums.length === 1 ? `Block ${nums[0]}` : `Blocks ${nums[0]}–${nums[nums.length - 1]}`;
}

export function parseJSON(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object found in the reply");
  return JSON.parse(t.slice(a, b + 1));
}

// Makes sure every focus block 1..n belongs to exactly one session, drops junk, and caps lengths.
function repairBlocks(rawBlocks, n) {
  const used = new Set();
  const out = [];
  for (const b of Array.isArray(rawBlocks) ? rawBlocks : []) {
    if (!b || typeof b !== "object") continue;
    const nums = [...new Set((Array.isArray(b.blockNums) ? b.blockNums : []).map(Number))]
      .filter(x => Number.isInteger(x) && x >= 1 && x <= n && !used.has(x))
      .sort((x, y) => x - y);
    if (!nums.length) continue;
    nums.forEach(x => used.add(x));
    const short = str(b.short, 60) || str(b.title, 60) || "Focus session";
    const tasks = (Array.isArray(b.tasks) ? b.tasks : []).map(t => str(t, 200)).filter(Boolean).slice(0, 8);
    out.push({ short, blockNums: nums, tasks: tasks.length ? tasks : [`Work on: ${short}`] });
  }
  for (let x = 1; x <= n; x++) {
    if (used.has(x)) continue;
    const target = out.find(b => b.blockNums.includes(x - 1)) || out.find(b => b.blockNums.includes(x + 1));
    if (target) {
      target.blockNums.push(x);
      target.blockNums.sort((p, q) => p - q);
    } else {
      out.push({ short: "Open focus", blockNums: [x], tasks: ["Continue the most important unfinished task"] });
    }
    used.add(x);
  }
  out.sort((p, q) => p.blockNums[0] - q.blockNums[0]);
  return out.map(b => ({ ...b, title: `${rangeLabel(b.blockNums)} · ${b.short}` }));
}

export function validateAndRepair(raw, { dates, n }) {
  if (!raw || typeof raw !== "object") throw new Error("the reply was not a JSON object");
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  if (!rawDays.length) throw new Error("the reply had no days");
  const byDate = new Map(rawDays.filter(d => d && typeof d.date === "string").map(d => [d.date.trim(), d]));
  const days = dates.map((date, i) => {
    const src = byDate.get(date) || rawDays[i] || {};
    return { date, label: str(src.label, 120) || "Focus day", blocks: repairBlocks(src.blocks, n) };
  });
  return { name: str(raw.name, 80), icon: pickIcon(raw.icon), days };
}

export function checkInputs({ key, model, goal, startDate, endDate, template }) {
  if (!key) return "Paste your API key first.";
  if (!model) return "Pick or type a model (use “Load models” to see the list).";
  if (!goal || goal.trim().length < 10) return "Describe what you want to accomplish (at least a sentence).";
  if (!startDate || !endDate) return "Pick a start and end date.";
  if (startDate > endDate) return "The end date must be on or after the start date.";
  const days = dateRange(startDate, endDate).length;
  if (days > MAX_DAYS) return `Keep the plan to ${MAX_DAYS} days or fewer (this one is ${days}).`;
  if (countStudyBlocks(template) < 1) return "Wake and sleep times leave no room for focus blocks. Widen the day.";
  return null;
}

// `icon` comes from the example chip the user picked, if any; otherwise the AI's choice is used.
// `onProgress` receives { stage: "schedule" | "ask" | "writing" | "check" | "retry", ... } as work happens.
export async function generatePlan({ provider, key, model, goal, startDate, endDate, template, icon, colorIndex = 0, onProgress = () => {} }) {
  const problem = checkInputs({ key, model, goal, startDate, endDate, template });
  if (problem) throw new Error(problem);

  const dates = dateRange(startDate, endDate);
  const n = countStudyBlocks(template);
  onProgress({ stage: "schedule", days: dates.length, blocks: n });
  const baseUser = buildUserPrompt({ goal: goal.trim(), dates, n, blockMin: template.blockMin });
  // Each day in the reply starts with a "date" key, so counting them tells which day is being written.
  const onText = text => onProgress({
    stage: "writing",
    day: Math.min(dates.length, Math.max(1, (text.match(/"date"\s*:/g) || []).length)),
    days: dates.length,
    chars: text.length,
  });

  let useSchema = true;
  let retryNote = "";
  let parseFailures = 0;
  const usage = { input: 0, output: 0, calls: 0 };
  const started = Date.now();
  while (true) {
    let text;
    try {
      onProgress({ stage: "ask" });
      const res = await generate(provider, key, model, { system: SYSTEM, user: baseUser + retryNote, schema: PLAN_SCHEMA, useSchema, onText });
      text = res.text;
      usage.input += res.usage.input;
      usage.output += res.usage.output;
      usage.calls++;
    } catch (e) {
      // Some models don't support schema-constrained output; the prompt alone still asks for JSON.
      if (useSchema && e.status === 400 && /format|schema|json|response_format|output_config/i.test(e.detail || e.message)) {
        useSchema = false;
        onProgress({ stage: "retry", reason: "this model doesn't support strict JSON mode, asking again without it" });
        continue;
      }
      throw e;
    }
    onProgress({ stage: "check" });
    try {
      const repaired = validateAndRepair(parseJSON(text), { dates, n });
      return {
        id: `p_${Date.now().toString(36)}`,
        name: repaired.name.length >= 3 ? repaired.name : nameFromGoal(goal),
        icon: icon || repaired.icon || "🎯",
        subtitle: `${formatDay(startDate)} → ${formatDay(endDate)} · made with ${model}`,
        color: PALETTE[colorIndex % PALETTE.length],
        source: "ai",
        goal: goal.trim(),
        startDate,
        endDate,
        template,
        days: repaired.days,
        usage: { ...usage, seconds: Math.round((Date.now() - started) / 100) / 10, cost: estimateCost(provider, model, usage) },
      };
    } catch (e) {
      parseFailures++;
      if (parseFailures > 1) throw new Error(`The AI's reply couldn't be turned into a plan (${e.message}). Try again or pick another model.`);
      retryNote = `\n\nYour previous reply could not be used (${e.message}). Reply again with only the JSON object.`;
      onProgress({ stage: "retry", reason: `the reply couldn't be read (${e.message}), asking once more` });
    }
  }
}
