import { addDays, dateRange, formatDay } from "../schedule.js";
import { STUDY_EXAMPLE } from "./study.js";
import { MICRO_EXAMPLE } from "./micro.js";

// Ready-made plans that load with one click, starting on the chosen day.
export const EXAMPLE_PLANS = [STUDY_EXAMPLE, MICRO_EXAMPLE];

// Short prompts for the chips next to "What do you want to accomplish?".
export const PROMPT_CHIPS = [
  { emoji: "📗", label: "Study week", days: 3, template: STUDY_EXAMPLE.template,
    goal: "Balanced study week for my courses: Statistics practice problems, read 2 Marketing chapters with notes, write a 1,000-word English essay due at the end. Short daily review." },
  { emoji: "📘", label: "Exam", days: 4, template: MICRO_EXAMPLE.template,
    goal: "Pass my Microeconomics exam on the last day. Topics: consumer theory, Slutsky equation, producer theory, perfect competition, monopoly, game theory and oligopoly, market failures. Calculations and graphs. I'm weakest at game theory and Slutsky." },
  { emoji: "🗣️", label: "Language", days: 5, template: { wake: "08:30", sleep: "21:30", blockMin: 40, breakMin: 10 },
    goal: "Learn basic Spanish for a trip: greetings, numbers, ordering food, asking for directions, small talk. Speak out loud every day and review vocabulary." },
  { emoji: "📝", label: "Project", days: 5, template: { wake: "08:00", sleep: "22:00", blockMin: 50, breakMin: 10 },
    goal: "Finish my 3,000-word term paper on renewable energy: research, outline, draft each section, edit, references, and submit on the last day." },
  { emoji: "💼", label: "Work", days: 5, template: { wake: "07:30", sleep: "22:00", blockMin: 50, breakMin: 10 },
    goal: "Get on top of my work week: finish the quarterly report, prepare Thursday's client presentation, clear my email backlog, and plan next week. Protect deep-focus time and batch small tasks." },
];

function rangeLabel(nums) {
  return nums.length === 1 ? `Block ${nums[0]}` : `Blocks ${nums[0]}–${nums[nums.length - 1]}`;
}

// Turns an example definition into a normal plan whose first day is startISO.
export function instantiateExample(def, startISO) {
  const endISO = addDays(startISO, def.days.length - 1);
  const dates = dateRange(startISO, endISO);
  return {
    id: def.id,
    name: def.name,
    icon: def.emoji,
    subtitle: `${formatDay(startISO)} → ${formatDay(endISO)} · example made with DeepSeek`,
    color: def.color,
    source: "example",
    goal: def.goal,
    startDate: startISO,
    endDate: endISO,
    template: def.template,
    usage: def.usage,
    days: def.days.map((d, i) => ({
      date: dates[i],
      label: d.label,
      blocks: d.blocks.map(b => ({ ...b, title: `${rangeLabel(b.blockNums)} · ${b.short}` })),
    })),
  };
}
